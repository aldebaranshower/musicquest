export const TimePeriod = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  YEARLY: 'yearly'
};

export const suggestOptimalPeriod = (listenCount) => {
  if (listenCount < 100) return TimePeriod.DAILY;
  if (listenCount < 1000) return TimePeriod.WEEKLY;
  if (listenCount < 10000) return TimePeriod.MONTHLY;
  if (listenCount < 50000) return TimePeriod.QUARTERLY;
  return TimePeriod.YEARLY;
};

const getStartOfPeriod = (timestamp, period) => {
  const date = new Date(timestamp);

  switch (period) {
    case TimePeriod.DAILY:
      date.setHours(0, 0, 0, 0);
      break;
    case TimePeriod.WEEKLY:
      const day = date.getDay();
      date.setDate(date.getDate() - day);
      date.setHours(0, 0, 0, 0);
      break;
    case TimePeriod.MONTHLY:
      date.setDate(1);
      date.setHours(0, 0, 0, 0);
      break;
    case TimePeriod.QUARTERLY:
      const quarter = Math.floor(date.getMonth() / 3);
      date.setMonth(quarter * 3, 1);
      date.setHours(0, 0, 0, 0);
      break;
    case TimePeriod.YEARLY:
      date.setMonth(0, 1);
      date.setHours(0, 0, 0, 0);
      break;
    default:
      break;
  }

  return date.getTime();
};

const formatPeriodLabel = (timestamp, period) => {
  const date = new Date(timestamp);

  switch (period) {
    case TimePeriod.DAILY:
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    case TimePeriod.WEEKLY:
      return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    case TimePeriod.MONTHLY:
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    case TimePeriod.QUARTERLY:
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      return `Q${quarter} ${date.getFullYear()}`;
    case TimePeriod.YEARLY:
      return date.getFullYear().toString();
    default:
      return date.toLocaleDateString();
  }
};

export const groupListensByTimePeriod = (listens, period, genreMap) => {
  const groups = new Map();

  listens.forEach(listen => {
    const timestamp = listen.timestamp || listen.listened_at;

    if (!timestamp || timestamp < 946684800 || timestamp > 2147483647) {
      return;
    }

    const timestampMs = timestamp * 1000;
    const date = new Date(timestampMs);

    if (date.getFullYear() < 2000 || date.getFullYear() > 2030) {
      return;
    }

    const periodStart = getStartOfPeriod(timestampMs, period);
    const periodKey = periodStart.toString();

    if (!groups.has(periodKey)) {
      groups.set(periodKey, {
        periodStart,
        periodLabel: formatPeriodLabel(periodStart, period),
        listens: [],
        genres: new Map()
      });
    }

    const group = groups.get(periodKey);
    group.listens.push(listen);

    const genres = genreMap.get(listen.artistName) || ['Unknown'];
    genres.forEach(genre => {
      group.genres.set(genre, (group.genres.get(genre) || 0) + 1);
    });
  });

  const sortedGroups = Array.from(groups.values()).sort((a, b) => a.periodStart - b.periodStart);

  return sortedGroups.map(group => ({
    ...group,
    genres: Array.from(group.genres.entries())
      .map(([genre, count]) => ({
        genre,
        count,
        percentage: (count / group.listens.length) * 100
      }))
      .sort((a, b) => b.count - a.count)
  }));
};

export const calculateGenreTransitions = (groupedData) => {
  const transitions = [];

  for (let i = 0; i < groupedData.length - 1; i++) {
    const currentPeriod = groupedData[i];
    const nextPeriod = groupedData[i + 1];

    const currentGenres = new Map(currentPeriod.genres.map(g => [g.genre, g.count]));
    const nextGenres = new Map(nextPeriod.genres.map(g => [g.genre, g.count]));

    const allGenres = new Set([...currentGenres.keys(), ...nextGenres.keys()]);

    const periodTransitions = [];
    allGenres.forEach(genre => {
      const fromCount = currentGenres.get(genre) || 0;
      const toCount = nextGenres.get(genre) || 0;

      if (fromCount > 0 || toCount > 0) {
        periodTransitions.push({
          genre,
          from: {
            period: currentPeriod.periodLabel,
            count: fromCount
          },
          to: {
            period: nextPeriod.periodLabel,
            count: toCount
          },
          change: toCount - fromCount
        });
      }
    });

    transitions.push({
      fromPeriod: currentPeriod.periodLabel,
      toPeriod: nextPeriod.periodLabel,
      transitions: periodTransitions
    });
  }

  return transitions;
};

export const calculateGenreDiversity = (genres) => {
  if (genres.length === 0) return 0;

  const total = genres.reduce((sum, g) => sum + g.count, 0);
  const entropy = genres.reduce((sum, g) => {
    const p = g.count / total;
    return sum - (p * Math.log2(p));
  }, 0);

  const maxEntropy = Math.log2(genres.length);
  return maxEntropy === 0 ? 0 : entropy / maxEntropy;
};
