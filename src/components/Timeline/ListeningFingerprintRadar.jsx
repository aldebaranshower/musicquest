import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export default function ListeningFingerprintRadar({ listens, width = 500, height = 500 }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!listens || listens.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const stats = calculateListeningStats(listens);

    const data = [
      { metric: 'Consistency', you: stats.consistency, avg: 60, max: 100 },
      { metric: 'Discovery', you: stats.discoveryRate, avg: 45, max: 100 },
      { metric: 'Replay Rate', you: stats.replayRate, avg: 50, max: 100 },
      { metric: 'Variety', you: stats.variety, avg: 55, max: 100 },
      { metric: 'Exploration', you: stats.exploration, avg: 40, max: 100 }
    ];

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;
    const levels = 5;

    const g = svg.append('g')
      .attr('transform', `translate(${centerX},${centerY})`);

    const angleSlice = (Math.PI * 2) / data.length;

    const radiusScale = d3.scaleLinear()
      .domain([0, 100])
      .range([0, radius]);

    for (let i = 0; i < levels; i++) {
      const levelRadius = radius * ((i + 1) / levels);

      g.append('circle')
        .attr('r', levelRadius)
        .attr('fill', 'none')
        .attr('stroke', '#374151')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '3,3');

      if (i === levels - 1) {
        g.append('text')
          .attr('x', 5)
          .attr('y', -levelRadius + 3)
          .attr('fill', '#6b7280')
          .style('font-size', '10px')
          .text('100');
      }
    }

    data.forEach((d, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const labelRadius = radius + 40;
      const x = labelRadius * Math.cos(angle);
      const y = labelRadius * Math.sin(angle);

      g.append('line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', radius * Math.cos(angle))
        .attr('y2', radius * Math.sin(angle))
        .attr('stroke', '#374151')
        .attr('stroke-width', 1);

      g.append('text')
        .attr('x', x)
        .attr('y', y)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', '#d1d5db')
        .style('font-size', '13px')
        .style('font-weight', '600')
        .text(d.metric);
    });

    const radarLine = d3.lineRadial()
      .angle((d, i) => angleSlice * i)
      .radius(d => radiusScale(d.avg))
      .curve(d3.curveLinearClosed);

    g.append('path')
      .datum(data)
      .attr('d', radarLine)
      .attr('fill', '#6b7280')
      .attr('fill-opacity', 0.15)
      .attr('stroke', '#6b7280')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,5');

    const radarLineUser = d3.lineRadial()
      .angle((d, i) => angleSlice * i)
      .radius(d => radiusScale(d.you))
      .curve(d3.curveLinearClosed);

    g.append('path')
      .datum(data)
      .attr('d', radarLineUser)
      .attr('fill', '#8b5cf6')
      .attr('fill-opacity', 0.3)
      .attr('stroke', '#8b5cf6')
      .attr('stroke-width', 3);

    g.selectAll('circle.data-point')
      .data(data)
      .join('circle')
      .attr('class', 'data-point')
      .attr('cx', (d, i) => radiusScale(d.you) * Math.cos(angleSlice * i - Math.PI / 2))
      .attr('cy', (d, i) => radiusScale(d.you) * Math.sin(angleSlice * i - Math.PI / 2))
      .attr('r', 5)
      .attr('fill', '#8b5cf6')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('r', 7)
          .attr('fill', '#a78bfa');

        tooltip.style('display', 'block')
          .html(`
            <div style="font-weight: 600; margin-bottom: 4px;">${d.metric}</div>
            <div style="color: #8b5cf6;">You: ${d.you.toFixed(0)}</div>
            <div style="color: #6b7280;">Average: ${d.avg}</div>
          `)
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 10}px`);
      })
      .on('mouseout', function() {
        d3.select(this)
          .attr('r', 5)
          .attr('fill', '#8b5cf6');

        tooltip.style('display', 'none');
      });

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .attr('fill', '#f3f4f6')
      .style('font-size', '18px')
      .style('font-weight', '600')
      .text('Your Listening Fingerprint');

    const legend = svg.append('g')
      .attr('transform', `translate(${width / 2 - 60}, ${height - 40})`);

    const legendData = [
      { label: 'You', color: '#8b5cf6', dash: false },
      { label: 'Average', color: '#6b7280', dash: true }
    ];

    legendData.forEach((item, i) => {
      const legendItem = legend.append('g')
        .attr('transform', `translate(${i * 80}, 0)`);

      legendItem.append('line')
        .attr('x1', 0)
        .attr('x2', 20)
        .attr('y1', 0)
        .attr('y2', 0)
        .attr('stroke', item.color)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', item.dash ? '5,5' : 'none');

      legendItem.append('text')
        .attr('x', 25)
        .attr('y', 4)
        .attr('fill', '#d1d5db')
        .style('font-size', '12px')
        .text(item.label);
    });

    const tooltip = d3.select('body').append('div')
      .style('position', 'absolute')
      .style('display', 'none')
      .style('background', 'rgba(17, 24, 39, 0.95)')
      .style('color', '#f3f4f6')
      .style('padding', '8px 12px')
      .style('border-radius', '6px')
      .style('border', '1px solid #374151')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('z-index', '1000');

    return () => {
      tooltip.remove();
    };

  }, [listens, width, height]);

  return (
    <div className="bg-gray-900 rounded-lg p-6 shadow-lg">
      <svg ref={svgRef} width={width} height={height}></svg>
    </div>
  );
}

function calculateListeningStats(listens) {
  const uniqueTracks = new Set(listens.map(l => `${l.trackName}-${l.artistName}`)).size;
  const totalListens = listens.length;

  const trackCounts = {};
  const artistCounts = {};
  const dailyListens = {};
  const genreCounts = {};

  listens.forEach(listen => {
    const trackKey = `${listen.trackName}-${listen.artistName}`;
    trackCounts[trackKey] = (trackCounts[trackKey] || 0) + 1;

    artistCounts[listen.artistName] = (artistCounts[listen.artistName] || 0) + 1;

    const timestamp = listen.timestamp || listen.listened_at;
    if (timestamp) {
      const date = new Date(timestamp * 1000).toISOString().split('T')[0];
      dailyListens[date] = (dailyListens[date] || 0) + 1;
    }

    const genre = listen.normalizedGenre || listen.genre || 'Unknown';
    genreCounts[genre] = (genreCounts[genre] || 0) + 1;
  });

  const replayedTracks = Object.values(trackCounts).filter(count => count > 1).length;
  const replayRate = (replayedTracks / uniqueTracks) * 100;

  const dailyListenArray = Object.values(dailyListens);
  const avgDaily = dailyListenArray.reduce((a, b) => a + b, 0) / dailyListenArray.length;
  const variance = dailyListenArray.reduce((sum, val) => sum + Math.pow(val - avgDaily, 2), 0) / dailyListenArray.length;
  const consistency = Math.max(0, 100 - (Math.sqrt(variance) / avgDaily) * 50);

  const uniqueArtists = Object.keys(artistCounts).length;
  const discoveryRate = Math.min(100, (uniqueArtists / totalListens) * 1000);

  const uniqueGenres = Object.keys(genreCounts).length;
  const variety = Math.min(100, uniqueGenres * 5);

  const timestamps = listens.map(l => l.timestamp || l.listened_at).filter(Boolean);
  const timeSpan = (Math.max(...timestamps) - Math.min(...timestamps)) / (365.25 * 24 * 60 * 60);
  const exploration = Math.min(100, (uniqueArtists / Math.max(1, timeSpan)) / 5);

  return {
    consistency: Math.round(consistency),
    discoveryRate: Math.round(discoveryRate),
    replayRate: Math.round(replayRate),
    variety: Math.round(variety),
    exploration: Math.round(exploration)
  };
}
