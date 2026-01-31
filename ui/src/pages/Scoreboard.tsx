import { useState, useEffect } from 'react';
import { Trophy, Medal, Award, Star, Crown, Zap } from 'lucide-react';

interface ScoreEntry {
  rank: number;
  address: string;
  difficulty: number;
  difficultyFormatted: string;
  timestamp: number;
  timeAgo: string;
}

export default function Scoreboard() {
  const [scoreboard, setScoreboard] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchScoreboard = async () => {
      try {
        const res = await fetch('/api/info/scoreboard?limit=20');
        const data = await res.json();
        setScoreboard(data.scoreboard || []);
      } catch (error) {
        console.error('Failed to fetch scoreboard');
      } finally {
        setLoading(false);
      }
    };

    fetchScoreboard();
    const interval = setInterval(fetchScoreboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-400" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-300" />;
      case 3:
        return <Medal className="w-6 h-6 text-amber-600" />;
      default:
        return <Star className="w-5 h-5 text-dark-500" />;
    }
  };

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border-yellow-500/30';
      case 2:
        return 'bg-gradient-to-r from-gray-400/20 to-gray-500/10 border-gray-400/30';
      case 3:
        return 'bg-gradient-to-r from-amber-600/20 to-amber-700/10 border-amber-600/30';
      default:
        return 'bg-dark-800/30 border-dark-700/50';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Trophy className="w-7 h-7 text-brand-500" />
          Best Difficulty Scoreboard
        </h1>
        <p className="text-dark-400 mt-1">
          Top miners by highest share difficulty achieved
        </p>
      </div>

      {scoreboard.length === 0 ? (
        <div className="card-gradient rounded-xl p-12 text-center">
          <Trophy className="w-16 h-16 text-dark-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Records Yet</h3>
          <p className="text-dark-400 max-w-md mx-auto">
            Start mining to appear on the scoreboard. The highest difficulty shares 
            will be recorded here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {scoreboard.map((entry) => (
            <div
              key={`${entry.address}-${entry.timestamp}`}
              className={`rounded-xl p-4 border transition-all hover:scale-[1.01] ${getRankStyle(entry.rank)}`}
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-dark-800">
                  {getRankIcon(entry.rank)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-white">#{entry.rank}</span>
                    <span className="text-dark-300 font-mono truncate">{entry.address}</span>
                  </div>
                  <p className="text-dark-400 text-sm">{entry.timeAgo}</p>
                </div>

                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <Zap className="w-5 h-5 text-brand-500" />
                    <span className="text-xl font-bold text-brand-400 font-mono">
                      {entry.difficultyFormatted}
                    </span>
                  </div>
                  <p className="text-dark-400 text-sm">Best Difficulty</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card-gradient rounded-xl p-5">
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <Award className="w-5 h-5 text-brand-500" />
          About the Scoreboard
        </h3>
        <div className="text-dark-400 space-y-2 text-sm">
          <p>
            The scoreboard tracks the highest difficulty shares submitted by miners. 
            A higher difficulty share indicates better luck and increases your chances 
            of finding a block.
          </p>
          <p>
            In solo mining, finding a block requires submitting a share that meets 
            the network difficulty. The scoreboard shows how close you've come!
          </p>
        </div>
      </div>
    </div>
  );
}
