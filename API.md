# API Documentation

This document describes the data formats and APIs used by MusicQuest.

## Table of Contents

1. [ListenBrainz JSON Format](#listenbrainz-json-format)
2. [Spotify JSON Format](#spotify-json-format)
3. [Genre Classification API](#genre-classification-api)
4. [Data Processing Flow](#data-processing-flow)

---

## ListenBrainz JSON Format

### Export Data

ListenBrainz exports listening history as JSON arrays. Each listen object contains:

```json
[
  {
    "listened_at": 1609459200,
    "track_metadata": {
      "artist_name": "The Beatles",
      "track_name": "Here Comes The Sun",
      "release_name": "Abbey Road",
      "additional_info": {
        "recording_mbid": "uuid-here",
        "artist_mbids": ["uuid-here"]
      }
    },
    "recording_msid": "uuid-here"
  }
]
```

### Field Descriptions

- `listened_at` (number): Unix timestamp in seconds
- `track_metadata` (object): Track information
  - `artist_name` (string): Artist name
  - `track_name` (string): Track title
  - `release_name` (string): Album name
  - `additional_info` (object): Optional metadata
- `recording_msid` (string): MessyBrainz ID

### Obtaining ListenBrainz Data

1. Visit [ListenBrainz Export](https://listenbrainz.org/settings/export/)
2. Click "Export your listens"
3. Download the JSON file
4. Upload to the visualizer

---

## Spotify JSON Format

### Extended Streaming History

Spotify's extended streaming history includes:

```json
[
  {
    "ts": "2024-01-01T12:00:00Z",
    "master_metadata_track_name": "Imagine",
    "master_metadata_album_artist_name": "John Lennon",
    "master_metadata_album_album_name": "Imagine",
    "ms_played": 183000,
    "spotify_track_uri": "spotify:track:id",
    "reason_start": "trackdone",
    "reason_end": "trackdone"
  }
]
```

### Field Descriptions

- `ts` (string): ISO 8601 timestamp
- `master_metadata_track_name` (string): Track title
- `master_metadata_album_artist_name` (string): Artist name
- `master_metadata_album_album_name` (string): Album name
- `ms_played` (number): Milliseconds played
- Additional metadata fields available

### Obtaining Spotify Data

1. Visit [Spotify Privacy Settings](https://www.spotify.com/account/privacy/)
2. Scroll to "Download your data"
3. Select "Extended streaming history"
4. Wait for email (can take 30 days)
5. Download and extract JSON files
6. Upload StreamingHistory files

### Filtering

The application filters Spotify listens:
- Only tracks played > 30 seconds are included
- This removes accidental plays and skips

---

## Genre Classification API

### ListenBrainz Similar Artists API

**Endpoint**: `https://labs.api.listenbrainz.org/similar-artists`

**Parameters**:
- `artist_mbid`: MusicBrainz ID of the artist
- `algorithm`: Similarity algorithm name

**Example Request**:
```javascript
GET https://labs.api.listenbrainz.org/similar-artists?artist_mbid={mbid}&algorithm=session_based_days_9000_session_300_contribution_5_threshold_15_limit_50_skip_30
```

**Response**:
```json
{
  "artist": {
    "name": "The Beatles",
    "mbid": "uuid-here",
    "tag": [
      { "name": "rock", "count": 100 },
      { "name": "pop", "count": 80 }
    ]
  },
  "similar_artists": [
    {
      "name": "The Rolling Stones",
      "mbid": "uuid-here",
      "similarity": 0.95
    }
  ]
}
```

### MusicBrainz API

**Base URL**: `https://musicbrainz.org/ws/2`

#### Artist Search

**Endpoint**: `/artist`

**Parameters**:
- `query`: Artist name to search
- `fmt`: Response format (json)
- `limit`: Number of results

**Example Request**:
```javascript
GET https://musicbrainz.org/ws/2/artist?query=Beatles&fmt=json&limit=1
```

**Response**:
```json
{
  "artists": [
    {
      "id": "uuid-here",
      "name": "The Beatles",
      "sort-name": "Beatles, The",
      "tags": [
        { "name": "rock", "count": 10 },
        { "name": "pop", "count": 8 }
      ]
    }
  ]
}
```

#### Artist Details with Tags

**Endpoint**: `/artist/{mbid}`

**Parameters**:
- `inc`: Include tags and genres
- `fmt`: Response format (json)

**Example Request**:
```javascript
GET https://musicbrainz.org/ws/2/artist/{mbid}?fmt=json&inc=tags+genres
```

---

## Genre Classification Algorithm

### Flow

1. **Check Cache**
   - Query IndexedDB for artist
   - Return if found and < 30 days old

2. **Search Artist**
   - Query MusicBrainz for artist MBID
   - Cache artist information

3. **Try ListenBrainz Similar Artists**
   - Request similar artists using MBID
   - Extract genres from tags
   - Take top 3 genres by count

4. **Fallback to MusicBrainz Tags**
   - Request artist tags from MusicBrainz
   - Sort by count
   - Take top 3 genres

5. **Handle Unknown**
   - Tag as "Unknown" if all methods fail
   - Allow manual classification (future feature)

6. **Cache Result**
   - Store in IndexedDB for 30 days
   - Include MBID for future lookups

### Genre Ranking

Genres are ranked by:
1. Count/score from API
2. Number of occurrences across similar artists
3. Tag popularity

### Rate Limiting

- **ListenBrainz**: 50 requests/second
- **MusicBrainz**: 1 request/second
- Automatic retry with exponential backoff (1s, 2s, 4s)
- Respects `X-RateLimit-Remaining` headers

---

## Data Processing Flow

### 1. File Upload

```
User uploads JSON → Validate format → Parse data → Store in IndexedDB
```

### 2. Genre Classification

```
Extract unique artists → For each artist:
  Check cache → API lookup → Cache result → Update progress
```

### 3. Time Period Grouping

```
Group listens by period → Calculate genre percentages → Generate statistics
```

### 4. Visualization

```
Process grouped data → Calculate transitions → Render D3.js visualization
```

---

## Internal Data Structures

### Parsed Listen Object

```typescript
{
  id: string;              // Unique identifier
  timestamp: number;       // Milliseconds since epoch
  trackName: string;       // Sanitized track name
  artistName: string;      // Sanitized artist name
  albumName: string;       // Sanitized album name
  source: 'listenbrainz' | 'spotify';
  recordingMsid?: string;  // ListenBrainz only
  msPlayed?: number;       // Spotify only
}
```

### Genre Cache Object

```typescript
{
  artist: string;      // Artist name (key)
  mbid?: string;       // MusicBrainz ID
  genres: string[];    // Array of genre names
  lastFetched: number; // Timestamp
}
```

### Grouped Period Object

```typescript
{
  periodStart: number;     // Period start timestamp
  periodLabel: string;     // Human-readable label
  listens: Listen[];       // Array of listens
  genres: Array<{
    genre: string;
    count: number;
    percentage: number;
  }>;
}
```

### Transition Object

```typescript
{
  fromPeriod: string;
  toPeriod: string;
  transitions: Array<{
    genre: string;
    from: { period: string; count: number };
    to: { period: string; count: number };
    change: number;
  }>;
}
```

---

## Error Handling

### Network Errors

- **Timeout**: 30 second timeout per request
- **Retry**: 3 attempts with exponential backoff
- **Fallback**: Continue with "Unknown" genre

### API Errors

- **401 Unauthorized**: Invalid API token
- **429 Rate Limited**: Automatic throttling
- **404 Not Found**: Fallback to alternative method
- **500 Server Error**: Retry with backoff

### Data Errors

- **Invalid JSON**: User-friendly error message
- **Missing Fields**: Use default values
- **Corrupt Data**: Skip invalid entries

---

## Performance Considerations

### Caching Strategy

- **Genre Cache**: 30 days in IndexedDB
- **Listen Data**: Persistent in IndexedDB
- **Settings**: Persistent in localStorage

### Optimization

- Batch API requests when possible
- Use Web Workers for large file parsing (future)
- Lazy load visualization components
- Debounce filter inputs (300ms)

### Data Limits

- **File Size**: 10MB maximum
- **Warning**: 8MB threshold
- **Recommended**: < 50,000 listens for optimal performance

---

## API Rate Limits

### ListenBrainz

- **Rate**: 50 requests/second
- **Headers**: `X-RateLimit-Remaining`, `X-RateLimit-Reset-In`
- **Burst**: Allowed within limits

### MusicBrainz

- **Rate**: 1 request/second
- **User-Agent**: Required (included automatically)
- **Respect**: Critical for API access

---

## Future Enhancements

- [ ] ListenBrainz API authentication for live fetch
- [ ] Streaming JSON parser for > 10MB files
- [ ] Web Worker for background processing
- [ ] Manual genre editing interface
- [ ] Custom genre mapping import/export

---

## References

- [ListenBrainz API Docs](https://listenbrainz.readthedocs.io/en/latest/users/api/)
- [MusicBrainz API Docs](https://musicbrainz.org/doc/MusicBrainz_API)
- [Spotify Data Export](https://support.spotify.com/article/data-rights-and-privacy-settings/)
