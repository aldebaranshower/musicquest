import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export default function ListeningClockVisualization({ listens, width = 500, height = 500 }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!listens || listens.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const hourCounts = Array(24).fill(0);
    listens.forEach(listen => {
      const timestamp = listen.timestamp || listen.listened_at;
      if (timestamp) {
        const hour = new Date(timestamp * 1000).getHours();
        hourCounts[hour]++;
      }
    });

    const maxCount = Math.max(...hourCounts);
    const data = hourCounts.map((count, hour) => ({
      hour,
      count,
      label: `${String(hour).padStart(2, '0')}:00`
    }));

    const centerX = width / 2;
    const centerY = height / 2;
    const innerRadius = Math.min(width, height) * 0.2;
    const outerRadius = Math.min(width, height) * 0.45;

    const g = svg.append('g')
      .attr('transform', `translate(${centerX},${centerY})`);

    const angleScale = d3.scaleLinear()
      .domain([0, 24])
      .range([0, 2 * Math.PI]);

    const radiusScale = d3.scaleLinear()
      .domain([0, maxCount])
      .range([innerRadius, outerRadius]);

    const colorScale = d3.scaleSequential()
      .domain([0, maxCount])
      .interpolator(d3.interpolateRgb('#1f2937', '#3b82f6'));

    const arc = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(d => radiusScale(d.count))
      .startAngle((d, i) => angleScale(i) - Math.PI / 2)
      .endAngle((d, i) => angleScale(i + 1) - Math.PI / 2)
      .cornerRadius(3);

    const bars = g.selectAll('path.bar')
      .data(data)
      .join('path')
      .attr('class', 'bar')
      .attr('d', arc)
      .attr('fill', d => colorScale(d.count))
      .attr('stroke', '#111827')
      .attr('stroke-width', 1);

    bars.on('mouseover', function(event, d) {
      d3.select(this)
        .attr('opacity', 0.8)
        .attr('stroke', '#60a5fa')
        .attr('stroke-width', 2);

      tooltip.style('display', 'block')
        .html(`<strong>${d.label}</strong><br/>${d.count.toLocaleString()} listens`)
        .style('left', `${event.pageX + 10}px`)
        .style('top', `${event.pageY - 10}px`);
    })
    .on('mouseout', function() {
      d3.select(this)
        .attr('opacity', 1)
        .attr('stroke', '#111827')
        .attr('stroke-width', 1);

      tooltip.style('display', 'none');
    });

    const clockLabels = [0, 3, 6, 9, 12, 15, 18, 21];
    clockLabels.forEach(hour => {
      const angle = angleScale(hour) - Math.PI / 2;
      const labelRadius = outerRadius + 30;
      const x = labelRadius * Math.cos(angle);
      const y = labelRadius * Math.sin(angle);

      g.append('text')
        .attr('x', x)
        .attr('y', y)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', '#9ca3af')
        .style('font-size', '14px')
        .style('font-weight', '600')
        .text(`${String(hour).padStart(2, '0')}:00`);

      g.append('line')
        .attr('x1', (outerRadius + 5) * Math.cos(angle))
        .attr('y1', (outerRadius + 5) * Math.sin(angle))
        .attr('x2', (outerRadius + 15) * Math.cos(angle))
        .attr('y2', (outerRadius + 15) * Math.sin(angle))
        .attr('stroke', '#4b5563')
        .attr('stroke-width', 2);
    });

    g.append('circle')
      .attr('r', innerRadius - 5)
      .attr('fill', 'none')
      .attr('stroke', '#374151')
      .attr('stroke-width', 2);

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .attr('fill', '#f3f4f6')
      .style('font-size', '18px')
      .style('font-weight', '600')
      .text('24-Hour Listening Clock');

    const peakHour = data.reduce((max, curr) => curr.count > max.count ? curr : max, data[0]);
    g.append('text')
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('fill', '#60a5fa')
      .style('font-size', '16px')
      .style('font-weight', '700')
      .text(peakHour.label);

    g.append('text')
      .attr('y', 10)
      .attr('text-anchor', 'middle')
      .attr('fill', '#9ca3af')
      .style('font-size', '12px')
      .text('Peak Hour');

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
