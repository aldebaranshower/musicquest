import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { getGenreColor } from '../../utils/genreColors';
import { getTopArtistsForGenre, getGenrePeakPeriod, getGenreDiscoveryDate } from '../../utils/gatewayArtistDetection';

const SankeyFlowVisualization = ({
  groupedData,
  gatewayArtists,
  genreMap,
  listens,
  width,
  height,
  onGenreHover,
  onGenreClick,
  onGatewayArtistClick,
  selectedGenre,
  unknownDisplay = 'faded'
}) => {
  const svgRef = useRef(null);
  const [hoveredGenre, setHoveredGenre] = useState(null);

  useEffect(() => {
    if (!groupedData.length || !svgRef.current) return;

    renderSankeyFlow();
  }, [groupedData, width, height, selectedGenre, unknownDisplay]);

  const renderSankeyFlow = () => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const validGroupedData = groupedData.filter(period => {
      const date = new Date(period.periodStart);
      const year = date.getFullYear();
      return year >= 2000 && year <= 2030 && !period.periodLabel.includes('1970');
    });

    if (validGroupedData.length === 0) return;

    const allGenres = new Set();
    validGroupedData.forEach(period => {
      period.genres.forEach(g => allGenres.add(g.genre));
    });

    const genreList = Array.from(allGenres)
      .filter(g => unknownDisplay === 'hide' ? g !== 'Unknown' : true);

    const xScale = d3.scaleLinear()
      .domain([0, validGroupedData.length - 1])
      .range([60, width - 60]);

    const yScale = d3.scaleLinear()
      .domain([0, 100])
      .range([height - 40, 40]);

    const g = svg.append('g');

    validGroupedData.forEach((period, i) => {
      const x = xScale(i);
      g.append('text')
        .attr('x', x)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .attr('fill', 'rgba(255, 255, 255, 0.7)')
        .attr('font-size', '14px')
        .attr('font-weight', '600')
        .attr('opacity', 0)
        .text(period.periodLabel)
        .transition()
        .duration(500)
        .delay(500)
        .attr('opacity', 1);
    });

    if (unknownDisplay !== 'hide') {
      validGroupedData.forEach((period, i) => {
        const unknownGenre = period.genres.find(g => g.genre === 'Unknown');
        if (unknownGenre) {
          const x = xScale(i);
          const barHeight = (unknownGenre.percentage / 100) * (height - 80);

          g.append('rect')
            .attr('x', x - 20)
            .attr('y', height - 40 - barHeight)
            .attr('width', 40)
            .attr('height', barHeight)
            .attr('fill', '#495057')
            .attr('opacity', unknownDisplay === 'faded' ? 0.2 : 0.8)
            .attr('rx', 4);
        }
      });
    }

    genreList
      .filter(g => g !== 'Unknown')
      .slice(0, 12)
      .forEach((genre, genreIdx) => {
        const pathData = [];

        validGroupedData.forEach((period, i) => {
          const genreData = period.genres.find(g => g.genre === genre);
          if (genreData) {
            const x = xScale(i);
            const percentage = genreData.percentage;
            const yCenter = yScale(50);
            const offset = (genreIdx - 6) * 30;

            pathData.push({
              x,
              y: yCenter + offset,
              percentage,
              count: genreData.count,
              periodLabel: period.periodLabel
            });
          }
        });

        if (pathData.length < 2) return;

        const line = d3.line()
          .x(d => d.x)
          .y(d => d.y)
          .curve(d3.curveCatmullRom.alpha(0.5));

        const isHighlighted = hoveredGenre === genre || selectedGenre === genre;
        const isDimmed = (hoveredGenre && hoveredGenre !== genre) || (selectedGenre && selectedGenre !== genre);

        const path = g.append('path')
          .datum(pathData)
          .attr('d', line)
          .attr('fill', 'none')
          .attr('stroke', getGenreColor(genre))
          .attr('stroke-width', d => {
            const avgPercentage = d3.mean(d, p => p.percentage);
            return Math.max(3, Math.min(20, avgPercentage * 2));
          })
          .attr('opacity', isDimmed ? 0.3 : (isHighlighted ? 1 : 0.8))
          .attr('stroke-linecap', 'round')
          .style('cursor', 'pointer')
          .on('mouseenter', function(event) {
            d3.select(this)
              .transition()
              .duration(200)
              .attr('opacity', 1)
              .attr('stroke-width', function() {
                const currentWidth = parseFloat(d3.select(this).attr('stroke-width'));
                return currentWidth * 1.2;
              });

            g.selectAll('path')
              .filter(function() { return this !== event.currentTarget; })
              .transition()
              .duration(200)
              .attr('opacity', 0.2);

            if (onGenreHover) {
              const topArtists = getTopArtistsForGenre(listens, genreMap, genre, 5);
              const peakPeriod = getGenrePeakPeriod(groupedData, genre);
              const totalCount = listens.filter(l => {
                const genres = genreMap.get(l.artistName) || [];
                return genres.includes(genre);
              }).length;
              const percentage = (totalCount / listens.length) * 100;

              onGenreHover({
                type: 'genre',
                genre,
                count: totalCount,
                percentage,
                topArtists,
                peakPeriod
              }, { x: event.pageX + 10, y: event.pageY + 10 });
            }
          })
          .on('mousemove', function(event) {
            if (onGenreHover) {
              const topArtists = getTopArtistsForGenre(listens, genreMap, genre, 5);
              const peakPeriod = getGenrePeakPeriod(groupedData, genre);
              const totalCount = listens.filter(l => {
                const genres = genreMap.get(l.artistName) || [];
                return genres.includes(genre);
              }).length;
              const percentage = (totalCount / listens.length) * 100;

              onGenreHover({
                type: 'genre',
                genre,
                count: totalCount,
                percentage,
                topArtists,
                peakPeriod
              }, { x: event.pageX + 10, y: event.pageY + 10 });
            }
          })
          .on('mouseleave', function() {
            d3.select(this)
              .transition()
              .duration(200)
              .attr('opacity', isDimmed ? 0.3 : (isHighlighted ? 1 : 0.8))
              .attr('stroke-width', function(d) {
                const avgPercentage = d3.mean(d, p => p.percentage);
                return Math.max(3, Math.min(20, avgPercentage * 2));
              });

            g.selectAll('path')
              .transition()
              .duration(200)
              .attr('opacity', function() {
                return isDimmed ? 0.3 : 0.8;
              });

            if (onGenreHover) {
              onGenreHover(null, {});
            }
          })
          .on('click', () => {
            if (onGenreClick) {
              onGenreClick(genre);
            }
          });

        const pathLength = path.node().getTotalLength();
        path
          .attr('stroke-dasharray', `${pathLength} ${pathLength}`)
          .attr('stroke-dashoffset', pathLength)
          .transition()
          .duration(2500)
          .delay(genreIdx * 150)
          .ease(d3.easeQuadInOut)
          .attr('stroke-dashoffset', 0);

        pathData.forEach((point, idx) => {
          if (idx % 2 === 0) {
            const circle = g.append('circle')
              .attr('cx', point.x)
              .attr('cy', point.y)
              .attr('r', 0)
              .attr('fill', getGenreColor(genre))
              .attr('opacity', isDimmed ? 0.3 : 0.8)
              .attr('stroke', 'white')
              .attr('stroke-width', 2)
              .style('cursor', 'pointer')
              .on('mouseenter', function(event) {
                d3.select(this)
                  .transition()
                  .duration(150)
                  .attr('r', 8);

                if (onGenreHover) {
                  onGenreHover({
                    type: 'genre',
                    genre,
                    count: point.count,
                    percentage: point.percentage,
                    period: point.periodLabel
                  }, { x: event.pageX + 10, y: event.pageY + 10 });
                }
              })
              .on('mousemove', function(event) {
                if (onGenreHover) {
                  onGenreHover({
                    type: 'genre',
                    genre,
                    count: point.count,
                    percentage: point.percentage,
                    period: point.periodLabel
                  }, { x: event.pageX + 10, y: event.pageY + 10 });
                }
              })
              .on('mouseleave', function() {
                d3.select(this)
                  .transition()
                  .duration(150)
                  .attr('r', 5);

                if (onGenreHover) {
                  onGenreHover(null, {});
                }
              });

            circle.transition()
              .duration(500)
              .delay(2500 + genreIdx * 150 + idx * 50)
              .attr('r', 5);
          }
        });

        if (pathData.length > 0) {
          const lastPoint = pathData[pathData.length - 1];
          g.append('text')
            .attr('x', lastPoint.x + 15)
            .attr('y', lastPoint.y + 5)
            .attr('font-size', '11px')
            .attr('font-weight', '700')
            .attr('fill', getGenreColor(genre))
            .attr('text-transform', 'uppercase')
            .attr('letter-spacing', '1px')
            .attr('opacity', 0)
            .text(genre.length > 12 ? genre.substring(0, 12) + '...' : genre)
            .style('pointer-events', 'none')
            .transition()
            .duration(500)
            .delay(3000 + genreIdx * 150)
            .attr('opacity', isDimmed ? 0.3 : 1);
        }
      });

    gatewayArtists.forEach(gateway => {
      if (gateway.periodIndex < validGroupedData.length) {
        const x = xScale(gateway.periodIndex);
        const genreData = validGroupedData[gateway.periodIndex].genres.find(
          g => g.genre === gateway.triggerGenre
        );

        if (genreData) {
          const genreIdx = genreList.indexOf(gateway.triggerGenre);
          const yCenter = yScale(50);
          const offset = (genreIdx - 6) * 30;

          const marker = g.append('g')
            .attr('transform', `translate(${x}, ${yCenter + offset})`)
            .style('cursor', 'pointer')
            .attr('opacity', 0)
            .on('click', () => {
              if (onGatewayArtistClick) {
                onGatewayArtistClick(gateway);
              }
            });

          marker.append('circle')
            .attr('r', 8)
            .attr('fill', getGenreColor(gateway.triggerGenre))
            .attr('stroke', 'white')
            .attr('stroke-width', 3);

          marker.append('circle')
            .attr('r', 12)
            .attr('fill', 'none')
            .attr('stroke', getGenreColor(gateway.triggerGenre))
            .attr('stroke-width', 2)
            .attr('opacity', 0.5);

          marker.transition()
            .duration(500)
            .delay(3500)
            .attr('opacity', 1);

          marker.select('circle:last-child')
            .attr('r', 12)
            .transition()
            .duration(2000)
            .ease(d3.easeQuadInOut)
            .attr('r', 16)
            .attr('opacity', 0)
            .on('end', function() {
              d3.select(this)
                .attr('r', 12)
                .attr('opacity', 0.5)
                .transition()
                .duration(2000)
                .ease(d3.easeQuadInOut)
                .attr('r', 16)
                .attr('opacity', 0)
                .on('end', function repeat() {
                  d3.select(this)
                    .attr('r', 12)
                    .attr('opacity', 0.5)
                    .transition()
                    .duration(2000)
                    .ease(d3.easeQuadInOut)
                    .attr('r', 16)
                    .attr('opacity', 0)
                    .on('end', repeat);
                });
            });
        }
      }
    });

    validGroupedData.forEach((period, i) => {
      const x = xScale(i);

      g.append('text')
        .attr('x', x)
        .attr('y', height - 10)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .attr('fill', 'currentColor')
        .attr('opacity', 0.7)
        .text(period.periodLabel);
    });
  };

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="w-full h-auto"
    />
  );
};

export default SankeyFlowVisualization;
