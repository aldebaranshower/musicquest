import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { getGenreColor } from '../../utils/genreColors';

const MilestoneTimelineVisualization = ({
  groupedData,
  milestones,
  genreMap,
  listens,
  width,
  height,
  onGenreHover,
  onGenreClick,
  onMilestoneClick,
  selectedGenre,
  unknownDisplay = 'faded'
}) => {
  const svgRef = useRef(null);
  const [hoveredGenre, setHoveredGenre] = useState(null);

  useEffect(() => {
    if (!listens || listens.length === 0) {
      console.warn('MilestoneTimeline: No listens data available');
      return;
    }

    if (!groupedData || groupedData.length === 0) {
      console.warn('MilestoneTimeline: No grouped data available');
      return;
    }

    if (!svgRef.current) return;

    try {
      renderMilestoneTimeline();
    } catch (error) {
      console.error('MilestoneTimeline rendering error:', error);
    }
  }, [groupedData, milestones, width, height, selectedGenre, unknownDisplay, listens]);

  const renderMilestoneTimeline = () => {
    try {
      const svg = d3.select(svgRef.current);
      svg.selectAll('*').remove();

      const margin = { top: 120, right: 40, bottom: 80, left: 140 };
      const chartWidth = width - margin.left - margin.right;
      const chartHeight = height - margin.top - margin.bottom;

      if (chartWidth <= 0 || chartHeight <= 0) {
        console.warn('MilestoneTimeline: Invalid dimensions');
        return;
      }

      // Filter valid data first
      const validGroupedData = groupedData.filter(period => {
        if (!period || !period.periodStart) return false;
        const date = new Date(period.periodStart);
        const year = date.getFullYear();
        return year >= 2000 && year <= 2030;
      });

      if (validGroupedData.length === 0) {
        console.warn('MilestoneTimeline: No valid data after filtering');
        return;
      }

      const g = svg.append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);

      // Build genre list from valid data
      const allGenres = new Set();
      validGroupedData.forEach(period => {
        if (period.genres && Array.isArray(period.genres)) {
          period.genres.forEach(g => {
            if (g && g.genre) allGenres.add(g.genre);
          });
        }
      });

      const genreList = Array.from(allGenres)
        .filter(g => unknownDisplay === 'hide' ? g !== 'Unknown' : true)
        .slice(0, 12);

      if (genreList.length === 0) {
        console.warn('MilestoneTimeline: No genres to display');
        return;
      }

    const xScale = d3.scaleLinear()
      .domain([0, validGroupedData.length - 1])
      .range([0, chartWidth]);

    const laneHeight = chartHeight / (genreList.length + 1);

    g.append('line')
      .attr('x1', 0)
      .attr('y1', chartHeight / 2)
      .attr('x2', chartWidth)
      .attr('y2', chartHeight / 2)
      .attr('stroke', '#E5E7EB')
      .attr('stroke-width', 2);

    genreList.forEach((genre, genreIdx) => {
      const y = genreIdx * laneHeight;

      const genreData = validGroupedData.map((period, idx) => {
        const data = period.genres.find(g => g.genre === genre);
        return {
          x: xScale(idx),
          percentage: data ? data.percentage : 0,
          count: data ? data.count : 0,
          periodLabel: period.periodLabel
        };
      });

      const maxPercentage = d3.max(genreData, d => d.percentage) || 1;

      const area = d3.area()
        .x(d => d.x)
        .y0(y + laneHeight)
        .y1(d => y + laneHeight - (d.percentage / maxPercentage) * laneHeight * 0.8)
        .curve(d3.curveCatmullRom.alpha(0.5));

      const isHighlighted = hoveredGenre === genre || selectedGenre === genre;
      const isDimmed = (hoveredGenre && hoveredGenre !== genre) || (selectedGenre && selectedGenre !== genre);

      const path = g.append('path')
        .datum(genreData)
        .attr('d', area)
        .attr('fill', getGenreColor(genre))
        .attr('opacity', genre === 'Unknown' && unknownDisplay === 'faded' ? 0.2 : (isDimmed ? 0.3 : 0.7))
        .attr('stroke', getGenreColor(genre))
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .style('transition', 'opacity 0.2s ease, stroke-width 0.2s ease')
        .on('mouseenter', function(event) {
          d3.select(this)
            .attr('opacity', 0.9)
            .attr('stroke-width', 3);

          if (onGenreHover) {
            const totalCount = genreData.reduce((sum, d) => sum + d.count, 0);
            const avgPercentage = d3.mean(genreData, d => d.percentage);

            onGenreHover({
              type: 'genre',
              genre,
              count: totalCount,
              percentage: avgPercentage
            }, { x: event.pageX + 10, y: event.pageY + 10 });
          }

          g.selectAll('path')
            .filter(function() { return this !== event.currentTarget; })
            .transition()
            .duration(200)
            .attr('opacity', function() {
              const currentGenre = d3.select(this).datum()[0]?.periodLabel || '';
              return 0.2;
            });
        })
        .on('mousemove', function(event) {
          if (onGenreHover) {
            const totalCount = genreData.reduce((sum, d) => sum + d.count, 0);
            const avgPercentage = d3.mean(genreData, d => d.percentage);

            onGenreHover({
              type: 'genre',
              genre,
              count: totalCount,
              percentage: avgPercentage
            }, { x: event.pageX + 10, y: event.pageY + 10 });
          }
        })
        .on('mouseleave', function() {
          d3.select(this)
            .attr('opacity', genre === 'Unknown' && unknownDisplay === 'faded' ? 0.2 : (isDimmed ? 0.3 : 0.7))
            .attr('stroke-width', 2);

          if (onGenreHover) {
            onGenreHover(null, {});
          }

          g.selectAll('path')
            .transition()
            .duration(200)
            .attr('opacity', function(d) {
              const pathGenre = d && d.length > 0 ? genreList[genreList.indexOf(genre)] : '';
              const pathIsDimmed = selectedGenre && selectedGenre !== pathGenre;
              return genre === 'Unknown' && unknownDisplay === 'faded' ? 0.2 : (pathIsDimmed ? 0.3 : 0.7);
            });
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
        .duration(2000)
        .delay(genreIdx * 100)
        .ease(d3.easeQuadInOut)
        .attr('stroke-dashoffset', 0);

      const genreLabelGroup = g.append('g')
        .attr('transform', `translate(-15, ${y + laneHeight - 5})`)
        .style('cursor', 'pointer')
        .on('click', () => {
          if (onGenreClick) {
            onGenreClick(genre);
          }
        });

      genreLabelGroup.append('text')
        .attr('text-anchor', 'end')
        .attr('font-size', '14px')
        .attr('font-weight', '600')
        .attr('fill', getGenreColor(genre))
        .attr('opacity', 0)
        .text(genre.length > 15 ? genre.substring(0, 15) + '...' : genre)
        .transition()
        .duration(500)
        .delay(2000 + genreIdx * 100)
        .attr('opacity', isDimmed ? 0.3 : 1);

      const totalCount = genreData.reduce((sum, d) => sum + d.count, 0);
      const avgPercentage = d3.mean(genreData, d => d.percentage);

      genreLabelGroup.append('text')
        .attr('text-anchor', 'end')
        .attr('dy', '16')
        .attr('font-size', '11px')
        .attr('fill', 'rgba(255, 255, 255, 0.5)')
        .attr('opacity', 0)
        .text(`${avgPercentage.toFixed(1)}%`)
        .transition()
        .duration(500)
        .delay(2000 + genreIdx * 100)
        .attr('opacity', isDimmed ? 0.2 : 0.5);

      g.append('line')
        .attr('x1', 0)
        .attr('y1', y + laneHeight - 5)
        .attr('x2', chartWidth)
        .attr('y2', y + laneHeight - 5)
        .attr('stroke', 'rgba(255, 255, 255, 0.05)')
        .attr('stroke-width', 1);
    });

    const LABEL_HEIGHT = 100;
    const LABEL_WIDTH = 260;
    const MIN_SPACING = 20;

    const positionedMilestones = milestones.map((milestone, idx) => {
      const x = xScale(milestone.periodIndex);
      return {
        ...milestone,
        x,
        streamY: chartHeight / 2,
        labelY: idx % 2 === 0 ? -chartHeight / 2 + 40 : chartHeight / 2 - 130,
        originalIdx: idx
      };
    });

    for (let iteration = 0; iteration < 50; iteration++) {
      let hasCollision = false;

      for (let i = 0; i < positionedMilestones.length; i++) {
        for (let j = i + 1; j < positionedMilestones.length; j++) {
          const m1 = positionedMilestones[i];
          const m2 = positionedMilestones[j];

          const xDistance = Math.abs(m2.x - m1.x);
          if (xDistance < LABEL_WIDTH + MIN_SPACING) {
            const yDistance = Math.abs(m2.labelY - m1.labelY);
            if (yDistance < LABEL_HEIGHT + MIN_SPACING) {
              hasCollision = true;

              if (m1.labelY < m2.labelY) {
                m1.labelY -= 8;
                m2.labelY += 8;
              } else {
                m1.labelY += 8;
                m2.labelY -= 8;
              }
            }
          }
        }
      }

      if (!hasCollision) break;
    }

    positionedMilestones.forEach(milestone => {
      milestone.labelY = Math.max(-chartHeight / 2 + 10, Math.min(milestone.labelY, chartHeight / 2 - LABEL_HEIGHT));
    });

    positionedMilestones.forEach((milestone, idx) => {
      const labelCenterX = milestone.x;
      const labelCenterY = milestone.labelY + LABEL_HEIGHT / 2;

      const connectorPath = `M ${labelCenterX} ${labelCenterY}
                             Q ${labelCenterX} ${(labelCenterY + milestone.streamY) / 2},
                               ${milestone.x} ${milestone.streamY}`;

      g.append('path')
        .attr('d', connectorPath)
        .attr('stroke', 'rgba(100, 200, 255, 0.4)')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5')
        .attr('fill', 'none')
        .attr('opacity', 0)
        .transition()
        .duration(800)
        .delay(2500 + idx * 100)
        .attr('opacity', 1);

      g.append('circle')
        .attr('cx', milestone.x)
        .attr('cy', milestone.streamY)
        .attr('r', 8)
        .attr('fill', milestone.genre ? getGenreColor(milestone.genre) : 'rgb(100, 200, 255)')
        .attr('stroke', 'white')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .attr('opacity', 0)
        .on('click', () => {
          if (onMilestoneClick) {
            onMilestoneClick(milestone);
          }
        })
        .transition()
        .duration(300)
        .delay(2500 + idx * 100)
        .attr('opacity', 1);

      const foreignObj = g.append('foreignObject')
        .attr('x', milestone.x - LABEL_WIDTH / 2)
        .attr('y', milestone.labelY)
        .attr('width', LABEL_WIDTH)
        .attr('height', LABEL_HEIGHT)
        .style('overflow', 'visible')
        .attr('opacity', 0);

      const labelDiv = foreignObj.append('xhtml:div')
        .attr('xmlns', 'http://www.w3.org/1999/xhtml')
        .style('width', '100%')
        .style('height', '100%');

      labelDiv.append('xhtml:div')
        .attr('class', 'bg-gray-900/95 border border-cyan-600/50 rounded-lg p-3 shadow-2xl backdrop-blur-sm cursor-pointer hover:border-cyan-400/70 transition-colors')
        .style('width', '100%')
        .style('height', '100%')
        .on('click', () => {
          if (onMilestoneClick) {
            onMilestoneClick(milestone);
          }
        })
        .html(`
          <div class="flex items-start gap-2">
            <span class="text-2xl">🎵</span>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-bold text-white truncate">
                ${milestone.title || ''}
              </div>
              ${milestone.subtitle ? `
                <div class="text-xs text-gray-400 mt-1 truncate italic">
                  ${milestone.subtitle}
                </div>
              ` : ''}
              <div class="text-xs text-cyan-400 mt-1">
                ${milestone.description || ''}
              </div>
            </div>
          </div>
        `);

      foreignObj.transition()
        .duration(400)
        .delay(2500 + idx * 100)
        .attr('opacity', 1);
    });

    validGroupedData.forEach((period, i) => {
      const x = xScale(i);

      g.append('text')
        .attr('x', x)
        .attr('y', chartHeight + 50)
        .attr('text-anchor', 'start')
        .attr('font-size', '16px')
        .attr('font-weight', '600')
        .attr('fill', 'white')
        .attr('dominant-baseline', 'middle')
        .attr('transform', `rotate(-90, ${x}, ${chartHeight + 50})`)
        .attr('opacity', 0.7)
        .text(period.periodLabel);
    });

    } catch (error) {
      console.error('Error rendering milestone timeline:', error);
      throw error;
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="w-full h-auto overflow-visible"
        style={{ display: 'block' }}
      />
    </div>
  );
};

export default MilestoneTimelineVisualization;
