export type MuscleGroup =
  // Anterior (Front)
  | 'upper-chest'
  | 'mid-lower-chest'
  | 'front-delts'
  | 'side-delts'
  | 'biceps'
  | 'forearm-flexors'
  | 'forearm-extensors'
  | 'rectus-abdominis'
  | 'obliques'
  | 'quads'
  | 'adductors'
  | 'calves'
  // Posterior (Back)
  | 'lats'
  | 'rhomboids-mid-traps'
  | 'upper-traps'
  | 'rear-delts'
  | 'triceps-long'
  | 'triceps-lateral'
  | 'lower-back'
  | 'glutes'
  | 'hamstrings';

export interface ExerciseMedia {
  id: string;
  filename: string;
  publicId: string;
  videoUrl: string;
  posterUrl: string;
  width: number;
  height: number;
  duration: number;
}

export interface Exercise {
  id: string;
  name: string;
  sets: string;
  reps: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  primaryMuscleGroupIds: MuscleGroup[];
  secondaryMuscleGroupIds: MuscleGroup[];
  videoFilename: string; // matches id in exerciseVideos.json
  coachingCue: string;
}

export interface WorkoutDay {
  id: string;
  dayNumber: number;
  title: string;
  focus: string;
  description: string;
  exercises: Exercise[];
}

export interface EnrichedExercise extends Exercise {
  media?: ExerciseMedia;
}

export interface EnrichedWorkoutDay extends Omit<WorkoutDay, 'exercises'> {
  exercises: EnrichedExercise[];
}

export interface SetDetail {
  setNumber: number;
  weight: string;
  reps: string;
  unit: 'kg' | 'lbs';
  completed: boolean;
  timestamp?: string;
}

export interface ExerciseLog {
  exerciseId: string;
  completedSets: number[];
  setDetails: Record<number, SetDetail>; // setIndex -> SetDetail
  previousBest?: {
    weight: string;
    reps: string;
    unit: 'kg' | 'lbs';
  };
}
