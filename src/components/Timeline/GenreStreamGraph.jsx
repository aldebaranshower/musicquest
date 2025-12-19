import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export default function GenreStreamGraph({
  listens,
  width = 900,
  height = 400,
  selectedGenre = null,
  dateRange = null,
  showUnknown = true
}) {
  const svgRef = useRef(null);

  useEffect(() => {
    console.log('🔄 StreamGraph filters changed:', { selectedGenre, dateRange, showUnknown, listensCount: listens?.length });

    if (!listens || listens.length === 0) return;

    // Filter listens based on filters
    let filteredListens = listens;

    if (dateRange?.start && dateRange?.end) {
      filteredListens = filteredListens.filter(listen => {
        const timestamp = listen.timestamp || listen.listened_at;
        if (!timestamp) return false;
        const date = new Date(timestamp * 1000);
        return date >= dateRange.start && date <= dateRange.end;
      });
    }

    if (selectedGenre) {
      filteredListens = filteredListens.filter(listen => {
        const genres = listen.genres || [listen.normalizedGenre || listen.genre];
        return genres.includes(selectedGenre);
      });
    }

    if (!showUnknown) {
      filteredListens = filteredListens.filter(listen => {
        const genre = listen.genres?.[0] || listen.normalizedGenre || listen.genre;
        return genre !== 'Unknown';
      });
    }

    console.log(`📊 Filtered: ${filteredListens.length}/${listens.length} listens`);

    if (filteredListens.length === 0) {
      console.warn('⚠️ No listens after filtering');
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 40, right: 120, bottom: 50, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const processedData = processListensToStreamData(filteredListens);
    if (!processedData || processedData.length === 0) return;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const stack = d3.stack()
      .keys(processedData.genres)
      .order(d3.stackOrderInsideOut)
      .offset(d3.stackOffsetWiggle);

    const series = stack(processedData.data);

    const validDates = processedData.data.map(d => d.date).filter(date => {
      const year = date.getFullYear();
      return year >= 2000 && year <= 2030;
    });

    const dateExtent = d3.extent(validDates);

    const x = d3.scaleTime()
      .domain(dateExtent)
      .range([0, innerWidth]);

    const y = d3.scaleLinear()
      .domain([
        d3.min(series, layer => d3.min(layer, d => d[0])),
        d3.max(series, layer => d3.max(layer, d => d[1]))
      ])
      .range([innerHeight, 0]);

    const color = d3.scaleOrdinal()
      .domain(processedData.genres)
      .range(['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4']);

    const area = d3.area()
      .x(d => x(d.data.date))
      .y0(d => y(d[0]))
      .y1(d => y(d[1]))
      .curve(d3.curveCatmullRom.alpha(0.5));

    g.selectAll('path')
      .data(series)
      .join('path')
      .attr('fill', d => color(d.key))
      .attr('d', area)
      .attr('opacity', 0.8)
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('opacity', 1)
          .attr('stroke', '#fff')
          .attr('stroke-width', 2);
      })
      .on('mouseout', function() {
        d3.select(this)
          .attr('opacity', 0.8)
          .attr('stroke', 'none');
      })
      .append('title')
      .text(d => d.key);

    const xAxis = d3.axisBottom(x)
      .ticks(8)
      .tickFormat(d3.timeFormat('%Y'));

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .selectAll('text')
      .attr('fill', '#9ca3af')
      .style('font-size', '12px')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em');

    g.selectAll('.domain, .tick line')
      .attr('stroke', '#374151');

    g.append('g')
      .attr('class', 'grid')
      .selectAll('line')
      .data(x.ticks(8))
      .join('line')
      .attr('x1', d => x(d))
      .attr('x2', d => x(d))
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#374151')
      .attr('stroke-width', 1)
      .attr('opacity', 0.1);

    const yTicks = y.ticks(5);
    g.append('g')
      .attr('class', 'grid')
      .selectAll('line')
      .data(yTicks)
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', d => y(d))
      .attr('y2', d => y(d))
      .attr('stroke', '#374151')
      .attr('stroke-width', 1)
      .attr('opacity', 0.1);

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 25)
      .attr('text-anchor', 'middle')
      .attr('fill', '#f3f4f6')
      .style('font-size', '18px')
      .style('font-weight', '600')
      .text('Genre Evolution Over Time');

    const legend = svg.append('g')
      .attr('transform', `translate(${width - 100}, ${margin.top})`);

    processedData.genres.forEach((genre, i) => {
      const legendRow = legend.append('g')
        .attr('transform', `translate(0, ${i * 25})`);

      legendRow.append('rect')
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', color(genre))
        .attr('rx', 3);

      legendRow.append('text')
        .attr('x', 20)
        .attr('y', 12)
        .attr('fill', '#d1d5db')
        .style('font-size', '12px')
        .text(genre);
    });

  }, [listens, width, height, selectedGenre, dateRange, showUnknown]);

  return (
    <div className="bg-gray-900 rounded-lg p-6 shadow-lg">
      <svg ref={svgRef} width={width} height={height}></svg>
    </div>
  );
}

function processListensToStreamData(listens) {
  const genreByDate = new Map();

  listens.forEach(listen => {
    const timestamp = listen.timestamp || listen.listened_at;

    if (!timestamp || timestamp < 946684800 || timestamp > 2147483647) {
      return;
    }

    const date = new Date(timestamp * 1000);
    const year = date.getFullYear();

    if (year < 2000 || year > 2030) {
      return;
    }

    const monthKey = `${year}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const genre = listen.genres?.[0] || listen.normalizedGenre || listen.genre || 'Unknown';

    if (!genreByDate.has(monthKey)) {
      genreByDate.set(monthKey, {});
    }

    const monthData = genreByDate.get(monthKey);
    monthData[genre] = (monthData[genre] || 0) + 1;
  });

  const allGenres = new Set();
  genreByDate.forEach(monthData => {
    Object.keys(monthData).forEach(genre => allGenres.add(genre));
  });

  const genreTotals = {};
  allGenres.forEach(genre => {
    genreTotals[genre] = 0;
    genreByDate.forEach(monthData => {
      genreTotals[genre] += monthData[genre] || 0;
    });
  });

  const topGenres = Object.entries(genreTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([genre]) => genre);

  const data = Array.from(genreByDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([dateStr, genreCounts]) => {
      const [year, month] = dateStr.split('-').map(Number);
      const dataPoint = {
        date: new Date(year, month - 1, 1)
      };

      topGenres.forEach(genre => {
        dataPoint[genre] = genreCounts[genre] || 0;
      });

      return dataPoint;
    });

  return {
    data,
    genres: topGenres
  };
}
