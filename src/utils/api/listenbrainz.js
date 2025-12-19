import { createAxiosInstance } from './axiosConfig';
import { listenBrainzLimiter } from './rateLimiter';

const LISTENBRAINZ_API = 'https://api.listenbrainz.org/1';
const LISTENBRAINZ_LABS_API = 'https://labs.api.listenbrainz.org';

const apiClient = createAxiosInstance(LISTENBRAINZ_API);

export const fetchUserListens = async (username, token, count = 1000, maxTs = null, minTs = null, onProgress, signal = null) => {
  try {
    let url = `https://api.listenbrainz.org/1/user/${username}/listens?count=${count}`;
    if (maxTs) url += `&max_ts=${maxTs}`;
    if (minTs) url += `&min_ts=${minTs}`;

    const headers = token
      ? { 'Authorization': `Token ${token}` }
      : {};

    console.log(`📡 Fetching: ${url}`);

    const response = await listenBrainzLimiter.throttle(async () => {
      const res = await fetch(url, { headers, signal });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API returned ${res.status}: ${errorText}`);
      }

      return res.json();
    });

    // DEBUG: Log actual response structure
    console.log('📦 API Response:', {
      hasPayload: !!response.payload,
      payloadKeys: response.payload ? Object.keys(response.payload) : [],
      hasListens: !!response.payload?.listens,
      listensLength: response.payload?.listens?.length || 0
    });

    // CRITICAL FIX: Check if payload exists and has listens
    if (!response.payload) {
      throw new Error('API response missing payload. Check username and permissions.');
    }

    if (!response.payload.listens) {
      throw new Error('API response missing listens array. User may have no listening history.');
    }

    if (!Array.isArray(response.payload.listens)) {
      throw new Error('API response listens is not an array');
    }

    const listens = response.payload.listens;

    if (onProgress) {
      onProgress({
        fetched: listens.length,
        total: response.payload.count || listens.length
      });
    }

    return {
      success: true,
      listens: listens,
      count: response.payload.count || 0
    };
  } catch (error) {
    console.error('❌ fetchUserListens error:', error);
    return {
      success: false,
      error: error.message,
      listens: []
    };
  }
};

export const fetchAllUserListens = async (username, token, onProgress, maxListens = null, signal = null) => {
  const allListens = [];
  const batchSize = 1000;
  let maxTs = null;
  let hasMore = true;
  let batchCount = 0;

  console.log('🚀 Starting full listen history fetch (1000 per request)...');

  while (hasMore) {
    // Check if abort signal was triggered
    if (signal?.aborted) {
      console.log('🛑 Import aborted by user');
      throw new DOMException('Import aborted by user', 'AbortError');
    }

    batchCount++;
    const result = await fetchUserListens(username, token, batchSize, maxTs, null, onProgress, signal);

    if (!result.success) {
      console.error(`❌ Batch ${batchCount} failed:`, result.error);
      return result;
    }

    if (result.listens.length === 0) {
      console.log('✅ No more listens to fetch');
      hasMore = false;
    } else {
      allListens.push(...result.listens);
      console.log(`📦 Batch ${batchCount}: Fetched ${result.listens.length} listens (Total: ${allListens.length.toLocaleString()})`);

      const oldestListen = result.listens[result.listens.length - 1];
      const oldestTimestamp = oldestListen?.listened_at;

      if (oldestTimestamp) {
        maxTs = oldestTimestamp - 1;
      } else {
        console.warn('⚠️ No listened_at timestamp found, stopping pagination');
        hasMore = false;
      }

      if (result.listens.length < batchSize) {
        console.log(`✅ Received ${result.listens.length} < ${batchSize}, reached end of history`);
        hasMore = false;
      }
    }

    if (maxListens && allListens.length >= maxListens) {
      console.log(`✅ Reached ${maxListens.toLocaleString()} record limit`);
      hasMore = false;
    }

    if (hasMore) {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

  console.log(`🎉 Fetch complete! Total: ${allListens.length.toLocaleString()} listens`);

  return {
    success: true,
    listens: allListens,
    count: allListens.length
  };
};

export const fetchSimilarArtists = async (artistMbid) => {
  try {
    const response = await listenBrainzLimiter.throttle(async () => {
      return await apiClient.get(`${LISTENBRAINZ_LABS_API}/similar-artists`, {
        params: {
          artist_mbid: artistMbid,
          algorithm: 'session_based_days_9000_session_300_contribution_5_threshold_15_limit_50_skip_30'
        },
        retry: 3
      });
    });

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('Failed to fetch similar artists:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
