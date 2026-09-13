import React, { useState } from 'react';
import { MuscleGroup } from '../types/workout';
import { Activity, Shield } from 'lucide-react';

interface AnatomyMapProps {
  primaryMuscles: MuscleGroup[];
  secondaryMuscles?: MuscleGroup[];
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
}

export const AnatomyMap: React.FC<AnatomyMapProps> = ({
  primaryMuscles = [],
  secondaryMuscles = [],
  size = 'md',
  showLabels = true,
}) => {
  const [activeTab, setActiveTab] = useState<'both' | 'front' | 'back'>('both');
  const [hoveredMuscle, setHoveredMuscle] = useState<string | null>(null);

  const getMuscleStatus = (group: MuscleGroup): 'primary' | 'secondary' | 'inactive' => {
    if (primaryMuscles.includes(group)) return 'primary';
    if (secondaryMuscles.includes(group)) return 'secondary';
    return 'inactive';
  };

  const getMuscleStyle = (group: MuscleGroup) => {
    const status = getMuscleStatus(group);
    if (status === 'primary') {
      return {
        fill: '#10b981', // emerald-500
        stroke: '#34d399',
        strokeWidth: '1.2',
        filter: 'drop-shadow(0px 0px 4px rgba(16, 185, 129, 0.8))',
        className: 'transition-all duration-300 cursor-pointer hover:opacity-90',
      };
    }
    if (status === 'secondary') {
      return {
        fill: '#06b6d4', // cyan-500
        stroke: '#22d3ee',
        strokeWidth: '1',
        filter: 'drop-shadow(0px 0px 3px rgba(6, 182, 212, 0.6))',
        className: 'transition-all duration-300 cursor-pointer hover:opacity-90',
      };
    }
    return {
      fill: '#18181c',
      stroke: '#27272a',
      strokeWidth: '0.8',
      className: 'transition-all duration-200 hover:fill-[#222228]',
    };
  };

  const sizeClasses = {
    sm: 'w-[140px] h-[160px]',
    md: 'w-[180px] sm:w-[210px] h-[210px]',
    lg: 'w-[260px] sm:w-[300px] h-[300px]',
  };

  return (
    <div className="flex flex-col items-center bg-[#0d0d10] border border-[#222227] rounded-xl p-3 shadow-inner">
      {/* Header & View Switcher */}
      <div className="flex items-center justify-between w-full mb-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span>Target Anatomy</span>
        </div>
        <div className="flex bg-[#16161a] p-0.5 rounded-lg border border-zinc-800 text-[10px] font-semibold text-zinc-400">
          <button
            onClick={() => setActiveTab('both')}
            className={`px-1.5 py-0.5 rounded ${activeTab === 'both' ? 'bg-emerald-500 text-black font-extrabold' : 'hover:text-white'}`}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab('front')}
            className={`px-1.5 py-0.5 rounded ${activeTab === 'front' ? 'bg-emerald-500 text-black font-extrabold' : 'hover:text-white'}`}
          >
            Front
          </button>
          <button
            onClick={() => setActiveTab('back')}
            className={`px-1.5 py-0.5 rounded ${activeTab === 'back' ? 'bg-emerald-500 text-black font-extrabold' : 'hover:text-white'}`}
          >
            Back
          </button>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className={`relative ${sizeClasses[size]} flex items-center justify-center`}>
        <svg
          viewBox="0 0 200 220"
          className="w-full h-full drop-shadow-md select-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* ================= ANTERIOR (FRONT) VIEW ================= */}
          {(activeTab === 'both' || activeTab === 'front') && (
            <g transform={activeTab === 'front' ? 'translate(50, 0)' : 'translate(0, 0)'}>
              <text x="47.5" y="10" textAnchor="middle" fill="#71717a" fontSize="8" fontWeight="bold">
                FRONT
              </text>
              {/* Head & Neck Base */}
              <circle cx="47.5" cy="22" r="9" fill="#18181c" stroke="#27272a" strokeWidth="0.8" />
              <path d="M 44 30 L 51 30 L 51 34 L 44 34 Z" fill="#18181c" stroke="#27272a" strokeWidth="0.8" />

              {/* Upper Traps */}
              <path
                d="M 38.5 31 Q 47.5 26 56.5 31 L 59 36 L 36 36 Z"
                {...getMuscleStyle('upper-traps')}
                onMouseEnter={() => setHoveredMuscle('Upper Traps')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />

              {/* Front Delts */}
              <path
                d="M 33 36 C 27 37 26 46 31 51 C 34 48 35 41 33 36 Z"
                {...getMuscleStyle('front-delts')}
                onMouseEnter={() => setHoveredMuscle('Anterior Delts')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />
              <path
                d="M 62 36 C 68 37 69 46 64 51 C 61 48 60 41 62 36 Z"
                {...getMuscleStyle('front-delts')}
                onMouseEnter={() => setHoveredMuscle('Anterior Delts')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />

              {/* Side Delts */}
              <path
                d="M 29 37 C 24 41 25 49 29 53 C 31 49 31 42 29 37 Z"
                {...getMuscleStyle('side-delts')}
                onMouseEnter={() => setHoveredMuscle('Lateral Delts')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />
              <path
                d="M 66 37 C 71 41 70 49 66 53 C 64 49 64 42 66 37 Z"
                {...getMuscleStyle('side-delts')}
                onMouseEnter={() => setHoveredMuscle('Lateral Delts')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />

              {/* Upper Chest */}
              <path
                d="M 36 37 Q 47.5 37 47.5 44 L 36 44 Z"
                {...getMuscleStyle('upper-chest')}
                onMouseEnter={() => setHoveredMuscle('Clavicular Pectorals (Upper Chest)')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />
              <path
                d="M 59 37 Q 47.5 37 47.5 44 L 59 44 Z"
                {...getMuscleStyle('upper-chest')}
                onMouseEnter={() => setHoveredMuscle('Clavicular Pectorals (Upper Chest)')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />

              {/* Mid / Lower Chest */}
              <path
                d="M 36 45 L 47.5 45 L 47.5 55 Q 39 55 36 50 Z"
                {...getMuscleStyle('mid-lower-chest')}
                onMouseEnter={() => setHoveredMuscle('Sternal Pectorals (Mid/Lower Chest)')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />
              <path
                d="M 59 45 L 47.5 45 L 47.5 55 Q 56 55 59 50 Z"
                {...getMuscleStyle('mid-lower-chest')}
                onMouseEnter={() => setHoveredMuscle('Sternal Pectorals (Mid/Lower Chest)')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />

              {/* Biceps */}
              <path
                d="M 30 51 C 26 56 26 64 30 69 C 33 64 33 56 30 51 Z"
                {...getMuscleStyle('biceps')}
                onMouseEnter={() => setHoveredMuscle('Biceps Brachii')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />
              <path
                d="M 65 51 C 69 56 69 64 65 69 C 62 64 62 56 65 51 Z"
                {...getMuscleStyle('biceps')}
                onMouseEnter={() => setHoveredMuscle('Biceps Brachii')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />

              {/* Forearm Flexors */}
              <path
                d="M 28 71 C 25 78 26 88 28 94 C 30 88 30 78 28 71 Z"
                {...getMuscleStyle('forearm-flexors')}
                onMouseEnter={() => setHoveredMuscle('Forearm Flexors')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />
              <path
                d="M 67 71 C 70 78 69 88 67 94 C 65 88 65 78 67 71 Z"
                {...getMuscleStyle('forearm-flexors')}
                onMouseEnter={() => setHoveredMuscle('Forearm Flexors')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />

              {/* Forearm Extensors */}
              <path
                d="M 24 71 C 21 78 23 88 25 94 C 27 88 26 78 24 71 Z"
                {...getMuscleStyle('forearm-extensors')}
                onMouseEnter={() => setHoveredMuscle('Forearm Extensors')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />
              <path
                d="M 71 71 C 74 78 72 88 70 94 C 68 88 69 78 71 71 Z"
                {...getMuscleStyle('forearm-extensors')}
                onMouseEnter={() => setHoveredMuscle('Forearm Extensors')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />

              {/* Rectus Abdominis (Abs) */}
              <path
                d="M 44 56 L 51 56 L 51 90 L 44 90 Z"
                {...getMuscleStyle('rectus-abdominis')}
                onMouseEnter={() => setHoveredMuscle('Rectus Abdominis')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />

              {/* Obliques */}
              <path
                d="M 36 55 L 43 56 L 43 88 L 38 83 Z"
                {...getMuscleStyle('obliques')}
                onMouseEnter={() => setHoveredMuscle('Obliques')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />
              <path
                d="M 59 55 L 52 56 L 52 88 L 57 83 Z"
                {...getMuscleStyle('obliques')}
                onMouseEnter={() => setHoveredMuscle('Obliques')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />

              {/* Quads */}
              <path
                d="M 36 93 Q 32 123 38 148 L 46 148 Q 47 123 45 93 Z"
                {...getMuscleStyle('quads')}
                onMouseEnter={() => setHoveredMuscle('Quadriceps')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />
              <path
                d="M 59 93 Q 63 123 57 148 L 49 148 Q 48 123 50 93 Z"
                {...getMuscleStyle('quads')}
                onMouseEnter={() => setHoveredMuscle('Quadriceps')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />

              {/* Adductors */}
              <path
                d="M 45 94 L 47 138 L 48 138 L 50 94 Z"
                {...getMuscleStyle('adductors')}
                onMouseEnter={() => setHoveredMuscle('Adductors')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />

              {/* Calves (Anterior) */}
              <path
                d="M 37 155 C 33 172 35 192 39 205 L 44 205 C 42 192 42 172 42 155 Z"
                {...getMuscleStyle('calves')}
                onMouseEnter={() => setHoveredMuscle('Calves')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />
              <path
                d="M 58 155 C 62 172 60 192 56 205 L 51 205 C 53 192 53 172 53 155 Z"
                {...getMuscleStyle('calves')}
                onMouseEnter={() => setHoveredMuscle('Calves')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />
            </g>
          )}

          {/* ================= POSTERIOR (BACK) VIEW ================= */}
          {(activeTab === 'both' || activeTab === 'back') && (
            <g transform={activeTab === 'back' ? 'translate(50, 0)' : 'translate(105, 0)'}>
              <text x="47.5" y="10" textAnchor="middle" fill="#71717a" fontSize="8" fontWeight="bold">
                BACK
              </text>
              {/* Head & Neck Base */}
              <circle cx="47.5" cy="22" r="9" fill="#18181c" stroke="#27272a" strokeWidth="0.8" />
              <path d="M 44 30 L 51 30 L 51 34 L 44 34 Z" fill="#18181c" stroke="#27272a" strokeWidth="0.8" />

              {/* Upper Traps (Back) */}
              <path
                d="M 38.5 31 Q 47.5 26 56.5 31 L 52.5 45 L 42.5 45 Z"
                {...getMuscleStyle('upper-traps')}
                onMouseEnter={() => setHoveredMuscle('Upper Traps')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />

              {/* Rear Delts */}
              <path
                d="M 32 37 C 26 38 25 47 30 52 C 33 49 34 42 32 37 Z"
                {...getMuscleStyle('rear-delts')}
                onMouseEnter={() => setHoveredMuscle('Posterior Delts')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />
              <path
                d="M 63 37 C 69 38 70 47 65 52 C 62 49 61 42 63 37 Z"
                {...getMuscleStyle('rear-delts')}
                onMouseEnter={() => setHoveredMuscle('Posterior Delts')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />

              {/* Triceps (Long Head) */}
              <path
                d="M 31 52 C 28 59 28 65 31 70 C 33 65 33 59 31 52 Z"
                {...getMuscleStyle('triceps-long')}
                onMouseEnter={() => setHoveredMuscle('Triceps (Long Head)')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />
              <path
                d="M 64 52 C 67 59 67 65 64 70 C 62 65 62 59 64 52 Z"
                {...getMuscleStyle('triceps-long')}
                onMouseEnter={() => setHoveredMuscle('Triceps (Long Head)')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />

              {/* Triceps (Lateral Head) */}
              <path
                d="M 28 52 C 25 59 26 65 28 70 C 30 65 30 59 28 52 Z"
                {...getMuscleStyle('triceps-lateral')}
                onMouseEnter={() => setHoveredMuscle('Triceps (Lateral Head)')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />
              <path
                d="M 67 52 C 70 59 69 65 67 70 C 65 65 65 59 67 52 Z"
                {...getMuscleStyle('triceps-lateral')}
                onMouseEnter={() => setHoveredMuscle('Triceps (Lateral Head)')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />

              {/* Rhomboids & Mid Traps */}
              <path
                d="M 41 45 L 54 45 L 52 59 L 43 59 Z"
                {...getMuscleStyle('rhomboids-mid-traps')}
                onMouseEnter={() => setHoveredMuscle('Rhomboids & Mid Traps')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />

              {/* Lats */}
              <path
                d="M 35 53 C 31 62 36 79 42 84 L 43 60 Z"
                {...getMuscleStyle('lats')}
                onMouseEnter={() => setHoveredMuscle('Latissimus Dorsi')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />
              <path
                d="M 60 53 C 64 62 59 79 53 84 L 52 60 Z"
                {...getMuscleStyle('lats')}
                onMouseEnter={() => setHoveredMuscle('Latissimus Dorsi')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />

              {/* Lower Back (Erectors) */}
              <path
                d="M 42 81 L 53 81 L 51 93 L 44 93 Z"
                {...getMuscleStyle('lower-back')}
                onMouseEnter={() => setHoveredMuscle('Erector Spinae (Lower Back)')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />

              {/* Glutes */}
              <path
                d="M 32 93 C 32 112 44 117 46 93 Z"
                {...getMuscleStyle('glutes')}
                onMouseEnter={() => setHoveredMuscle('Gluteus Maximus')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />
              <path
                d="M 63 93 C 63 112 51 117 49 93 Z"
                {...getMuscleStyle('glutes')}
                onMouseEnter={() => setHoveredMuscle('Gluteus Maximus')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />

              {/* Hamstrings */}
              <path
                d="M 33 119 Q 29 142 35 149 L 43 149 Q 44 142 44 119 Z"
                {...getMuscleStyle('hamstrings')}
                onMouseEnter={() => setHoveredMuscle('Hamstrings')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />
              <path
                d="M 62 119 Q 66 142 60 149 L 52 149 Q 51 142 51 119 Z"
                {...getMuscleStyle('hamstrings')}
                onMouseEnter={() => setHoveredMuscle('Hamstrings')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />

              {/* Calves (Posterior) */}
              <path
                d="M 34 155 C 29 172 32 192 36 205 L 41 205 C 40 192 42 172 42 155 Z"
                {...getMuscleStyle('calves')}
                onMouseEnter={() => setHoveredMuscle('Calves (Gastrocnemius)')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />
              <path
                d="M 61 155 C 66 172 63 192 59 205 L 54 205 C 55 192 53 172 53 155 Z"
                {...getMuscleStyle('calves')}
                onMouseEnter={() => setHoveredMuscle('Calves (Gastrocnemius)')}
                onMouseLeave={() => setHoveredMuscle(null)}
              />
            </g>
          )}
        </svg>
      </div>

      {/* Legend & Hover Info */}
      {showLabels && (
        <div className="w-full mt-2 pt-2 border-t border-[#1a1a20] flex items-center justify-between text-[10px] text-zinc-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 font-semibold text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50 inline-block" /> Primary
            </span>
            <span className="flex items-center gap-1 font-semibold text-cyan-400">
              <span className="w-2 h-2 rounded-full bg-cyan-500 shadow-sm shadow-cyan-500/50 inline-block" /> Secondary
            </span>
          </div>

          <div className="font-mono text-zinc-300 font-medium truncate max-w-[120px]">
            {hoveredMuscle || 'Hover muscle'}
          </div>
        </div>
      )}
    </div>
  );
};
