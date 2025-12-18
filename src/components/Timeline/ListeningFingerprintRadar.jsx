import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { calculateListeningFingerprint, validateFingerprintData } from '../../utils/listeningStats';

export default function ListeningFingerprintRadar({ listens, width = 500, height = 500 }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!listens || listens.length === 0) {
      console.log('⏳ No listens data for fingerprint');
      return;
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 CALCULATING LISTENING FINGERPRINT');
    console.log(`   Processing ${listens.length.toLocaleString()} listens...`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const stats = calculateListeningFingerprint(listens);
    const validated = validateFingerprintData(stats);

    if (!validated) {
      console.error('❌ Failed to validate fingerprint data');
      return;
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ FINGERPRINT CALCULATED');
    console.log(`   Consistency:  ${validated.consistency}/100`);
    console.log(`   Discovery:    ${validated.discovery}/100`);
    console.log(`   Variety:      ${validated.variety}/100`);
    console.log(`   Replay Rate:  ${validated.replayRate}/100`);
    console.log(`   Exploration:  ${validated.exploration}/100`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const data = [
      { metric: 'Consistency', you: validated.consistency, avg: 60, max: 100 },
      { metric: 'Discovery', you: validated.discovery, avg: 45, max: 100 },
      { metric: 'Replay Rate', you: validated.replayRate, avg: 50, max: 100 },
      { metric: 'Variety', you: validated.variety, avg: 55, max: 100 },
      { metric: 'Exploration', you: validated.exploration, avg: 40, max: 100 }
    ];

    const hasInvalidData = data.some(d =>
      isNaN(d.you) || isNaN(d.avg) ||
      d.you === undefined || d.avg === undefined ||
      d.you === null || d.avg === null
    );

    if (hasInvalidData) {
      console.error('❌ Invalid radar data detected:', data);
      return;
    }

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

