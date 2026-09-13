import { Exercise, WorkoutDay, ExerciseMedia, EnrichedWorkoutDay } from '../types/workout';
import exerciseVideosData from './exerciseVideos.json';

export const exerciseMediaMap: Record<string, ExerciseMedia> = (exerciseVideosData as ExerciseMedia[]).reduce(
  (acc, media) => {
    acc[media.id] = media;
    acc[media.id.toLowerCase()] = media;
    return acc;
  },
  {} as Record<string, ExerciseMedia>
);

export const workoutProgram: WorkoutDay[] = [
  {
    id: 'day-1',
    dayNumber: 1,
    title: 'Upper A',
    focus: 'Upper Body Hypertrophy & Chest/Lat Bias',
    description: 'Target upper chest, lats, anterior delts, and arms with strict form.',
    exercises: [
      {
        id: 'incline-db-press',
        name: 'Incline DB Press',
        sets: '3',
        reps: '6–8',
        primaryMuscles: ['Clavicular Pectorals (Upper Chest)'],
        secondaryMuscles: ['Anterior Deltoids', 'Triceps'],
        primaryMuscleGroupIds: ['upper-chest'],
        secondaryMuscleGroupIds: ['front-delts', 'triceps-lateral'],
        videoFilename: 'incline-db-press',
        coachingCue: 'Keep elbows at ~45-60°, retract scapula, squeeze upper chest at the top.'
      },
      {
        id: 'lat-pulldown',
        name: 'Lat Pulldown',
        sets: '3',
        reps: '8–10',
        primaryMuscles: ['Latissimus Dorsi'],
        secondaryMuscles: ['Upper Back', 'Biceps'],
        primaryMuscleGroupIds: ['lats'],
        secondaryMuscleGroupIds: ['rhomboids-mid-traps', 'biceps'],
        videoFilename: 'lat-pulldown',
        coachingCue: 'Drive elbows straight down to your pockets; avoid excessive back swinging.'
      },
      {
        id: 'machine-shoulder-press',
        name: 'Machine Shoulder Press',
        sets: '3',
        reps: '8–10',
        primaryMuscles: ['Anterior Deltoids'],
        secondaryMuscles: ['Lateral Deltoids', 'Triceps'],
        primaryMuscleGroupIds: ['front-delts'],
        secondaryMuscleGroupIds: ['side-delts', 'triceps-lateral'],
        videoFilename: 'machine-shoulder-press',
        coachingCue: 'Control the eccentric descent down to chin level before pressing vertically.'
      },
      {
        id: 'one-arm-dumbbell-row',
        name: 'One-Arm DB Row',
        sets: '3',
        reps: '8–10',
        primaryMuscles: ['Lower/Mid Lats'],
        secondaryMuscles: ['Rhomboids', 'Core Stabilizers'],
        primaryMuscleGroupIds: ['lats'],
        secondaryMuscleGroupIds: ['rhomboids-mid-traps'],
        videoFilename: 'one-arm-dumbbell-row',
        coachingCue: 'Pull toward your hip crease, keeping torso steady and spine neutral.'
      },
      {
        id: 'rope-cable-tricep-pushdown',
        name: 'Rope Cable Tricep Pushdown',
        sets: '2–3',
        reps: '10–12',
        primaryMuscles: ['Triceps (Lateral & Medial Heads)'],
        secondaryMuscles: [],
        primaryMuscleGroupIds: ['triceps-lateral'],
        secondaryMuscleGroupIds: [],
        videoFilename: 'rope-cable-tricep-pushdown',
        coachingCue: 'Lock elbows to ribs; flare rope outward at full lockout.'
      },
      {
        id: 'incline-db-supinated-wrist-curl',
        name: 'Incline DB Supinating Curl',
        sets: '2–3',
        reps: '8–10',
        primaryMuscles: ['Biceps Brachii (Long Head)'],
        secondaryMuscles: ['Forearms'],
        primaryMuscleGroupIds: ['biceps'],
        secondaryMuscleGroupIds: ['forearm-flexors'],
        videoFilename: 'incline-db-supinated-wrist-curl',
        coachingCue: 'Start neutral, supinate wrist hard as you curl upward through the stretch.'
      }
    ]
  },
  {
    id: 'day-2',
    dayNumber: 2,
    title: 'Lower A',
    focus: 'Quad & Hamstring Foundation',
    description: 'Heavy compound leg drive paired with hamstring hinge overload.',
    exercises: [
      {
        id: 'leg-press',
        name: 'Leg Press',
        sets: '3',
        reps: '8–10',
        primaryMuscles: ['Quadriceps'],
        secondaryMuscles: ['Glutes', 'Adductors'],
        primaryMuscleGroupIds: ['quads'],
        secondaryMuscleGroupIds: ['glutes', 'adductors'],
        videoFilename: 'leg-press',
        coachingCue: 'Lower sled deep until knees hit 90° without letting hips roll off the seat.'
      },
      {
        id: 'rdl',
        name: 'Romanian Deadlift (RDL)',
        sets: '3',
        reps: '8–10',
        primaryMuscles: ['Hamstrings'],
        secondaryMuscles: ['Gluteus Maximus', 'Erector Spinae'],
        primaryMuscleGroupIds: ['hamstrings'],
        secondaryMuscleGroupIds: ['glutes', 'lower-back'],
        videoFilename: 'rdl',
        coachingCue: 'Hinge at the hips, push butt back toward wall, soft knee bend.'
      },
      {
        id: 'bulgarian-split-squat',
        name: 'Bulgarian Split Squat',
        sets: '3',
        reps: '8–10/leg',
        primaryMuscles: ['Quadriceps', 'Gluteus Maximus'],
        secondaryMuscles: ['Glute Medius Stabilizers'],
        primaryMuscleGroupIds: ['quads', 'glutes'],
        secondaryMuscleGroupIds: [],
        videoFilename: 'bulgarian-split-squat',
        coachingCue: 'Slight forward torso lean for glute bias; drop back knee toward floor.'
      },
      {
        id: 'seated-leg-curl',
        name: 'Seated Leg Curl',
        sets: '3',
        reps: '10–12',
        primaryMuscles: ['Hamstrings (Knee Flexion)'],
        secondaryMuscles: [],
        primaryMuscleGroupIds: ['hamstrings'],
        secondaryMuscleGroupIds: [],
        videoFilename: 'seated-leg-curl',
        coachingCue: 'Lock thighs firmly under pad; curl heels fully under seat with controlled tempo.'
      },
      {
        id: 'standing-calf-raises',
        name: 'Standing Calf Raises',
        sets: '3',
        reps: '12–15',
        primaryMuscles: ['Gastrocnemius (Calves)'],
        secondaryMuscles: ['Soleus'],
        primaryMuscleGroupIds: ['calves'],
        secondaryMuscleGroupIds: [],
        videoFilename: 'standing-calf-raises',
        coachingCue: 'Full 2-second stretch at the bottom, drive through balls of feet to peak squeeze.'
      }
    ]
  },
  {
    id: 'day-3',
    dayNumber: 3,
    title: 'Push (+ Abs A)',
    focus: 'Chest, Side Delts, Triceps & Lower Core',
    description: 'Hypertrophy isolation for pressing muscles paired with intense ab work.',
    exercises: [
      {
        id: 'flat-db-press',
        name: 'Flat DB Press',
        sets: '3',
        reps: '8–10',
        primaryMuscles: ['Sternal Pectorals (Mid/Lower Chest)'],
        secondaryMuscles: ['Anterior Deltoids', 'Triceps'],
        primaryMuscleGroupIds: ['mid-lower-chest'],
        secondaryMuscleGroupIds: ['front-delts', 'triceps-lateral'],
        videoFilename: 'flat-db-press',
        coachingCue: 'Maintain slight arch, plant feet flat, press over mid-chest.'
      },
      {
        id: 'standing-cable-fly',
        name: 'Standing Cable Fly',
        sets: '3',
        reps: '10–12',
        primaryMuscles: ['Pectorals'],
        secondaryMuscles: ['Anterior Deltoids'],
        primaryMuscleGroupIds: ['mid-lower-chest'],
        secondaryMuscleGroupIds: ['front-delts'],
        videoFilename: 'standing-cable-fly',
        coachingCue: 'Hug a wide barrel; focus on bringing biceps together across the chest.'
      },
      {
        id: 'btb-lateral-raise',
        name: 'Behind-the-Back Cable Lateral Raise',
        sets: '4',
        reps: '12–15',
        primaryMuscles: ['Lateral Deltoids'],
        secondaryMuscles: [],
        primaryMuscleGroupIds: ['side-delts'],
        secondaryMuscleGroupIds: [],
        videoFilename: 'btb-lateral-raise',
        coachingCue: 'Cable set at wrist height; sweep arm out sideways with minimal trap shrug.'
      },
      {
        id: 'cable-overhead-tricep-extension',
        name: 'Cable Overhead Tricep Extension',
        sets: '3',
        reps: '10–12',
        primaryMuscles: ['Triceps (Long Head)'],
        secondaryMuscles: [],
        primaryMuscleGroupIds: ['triceps-long'],
        secondaryMuscleGroupIds: [],
        videoFilename: 'cable-overhead-tricep-extension',
        coachingCue: 'Keep elbows pinned high near ears; stretch deep behind head before extending.'
      },
      {
        id: 'reverse-crunch-abs-a',
        name: 'Reverse Crunch',
        sets: '3',
        reps: '10–15',
        primaryMuscles: ['Lower Rectus Abdominis'],
        secondaryMuscles: ['Hip Flexors'],
        primaryMuscleGroupIds: ['rectus-abdominis'],
        secondaryMuscleGroupIds: [],
        videoFilename: 'reverse-crunch',
        coachingCue: 'Curl tailbone upward off the mat toward your ribs; do not swing legs.'
      },
      {
        id: 'decline-ab-crunch',
        name: 'Decline Ab Crunch',
        sets: '3',
        reps: '12–15',
        primaryMuscles: ['Upper Rectus Abdominis'],
        secondaryMuscles: ['Core Stabilizers'],
        primaryMuscleGroupIds: ['rectus-abdominis'],
        secondaryMuscleGroupIds: [],
        videoFilename: 'decline-ab-crunch',
        coachingCue: 'Controlled thoracic flexion; roll ribs down toward pelvis, deep bottom stretch.'
      }
    ]
  },
  {
    id: 'day-4',
    dayNumber: 4,
    title: 'Pull (+ Abs B)',
    focus: 'Back Thickness, Rear Delts, Forearms & Obliques',
    description: 'Comprehensive pull session for upper back density and forearm hypertrophy.',
    exercises: [
      {
        id: 'seated-cable-row',
        name: 'Seated Cable Row',
        sets: '3',
        reps: '10–12',
        primaryMuscles: ['Upper Back (Rhomboids, Mid Traps)'],
        secondaryMuscles: ['Rear Delts', 'Lats', 'Biceps'],
        primaryMuscleGroupIds: ['rhomboids-mid-traps'],
        secondaryMuscleGroupIds: ['lats', 'rear-delts', 'biceps'],
        videoFilename: 'seated-cable-row',
        coachingCue: 'Initiate by retracting shoulder blades, then pull handle toward sternum.'
      },
      {
        id: 'straight-arm-cable-pulldown',
        name: 'Straight-Arm Cable Pulldown',
        sets: '2–3',
        reps: '12–15',
        primaryMuscles: ['Latissimus Dorsi'],
        secondaryMuscles: ['Teres Major', 'Core'],
        primaryMuscleGroupIds: ['lats'],
        secondaryMuscleGroupIds: [],
        videoFilename: 'straight-arm-cable-pulldown',
        coachingCue: 'Slight forward torso hinge; sweep bar down in an arc to thighs with stiff arms.'
      },
      {
        id: 'cable-facepull',
        name: 'Cable Facepulls',
        sets: '3',
        reps: '12–15',
        primaryMuscles: ['Posterior Deltoids', 'Rotator Cuffs'],
        secondaryMuscles: ['Upper Traps'],
        primaryMuscleGroupIds: ['rear-delts'],
        secondaryMuscleGroupIds: ['upper-traps'],
        videoFilename: 'cable-facepull',
        coachingCue: 'Pull rope to bridge of nose/forehead, externally rotating fists back past ears.'
      },
      {
        id: 'db-hammer-curl',
        name: 'DB Hammer Curl',
        sets: '3',
        reps: '10–12',
        primaryMuscles: ['Brachialis', 'Brachioradialis'],
        secondaryMuscles: ['Biceps Brachii'],
        primaryMuscleGroupIds: ['biceps', 'forearm-flexors'],
        secondaryMuscleGroupIds: [],
        videoFilename: 'db-hammer-curl',
        coachingCue: 'Thumbs-up neutral grip throughout; curl strictly without swinging shoulders.'
      },
      {
        id: 'seated-db-supinated-wrist-curls',
        name: 'Seated DB Supinated Wrist Curls',
        sets: '2',
        reps: '12–15',
        primaryMuscles: ['Forearm Flexors'],
        secondaryMuscles: ['Grip Strength'],
        primaryMuscleGroupIds: ['forearm-flexors'],
        secondaryMuscleGroupIds: [],
        videoFilename: 'seated-db-supinated-wrist-curls',
        coachingCue: 'Forearms resting on thighs, curl wrists upward and lower slowly.'
      },
      {
        id: 'seated-db-pronated-wrist-curls',
        name: 'Seated DB Pronated Wrist Curls',
        sets: '2',
        reps: '12–15',
        primaryMuscles: ['Forearm Extensors'],
        secondaryMuscles: ['Grip Strength'],
        primaryMuscleGroupIds: ['forearm-extensors'],
        secondaryMuscleGroupIds: [],
        videoFilename: 'seated-db-pronated-wrist-curls',
        coachingCue: 'Palms facing down, raise backs of hands toward ceiling under strict control.'
      },
      {
        id: 'bicycle-crunches',
        name: 'Slow-Tempo Bicycle Crunches',
        sets: '3',
        reps: '12–16 total',
        primaryMuscles: ['Obliques'],
        secondaryMuscles: ['Rectus Abdominis'],
        primaryMuscleGroupIds: ['obliques', 'rectus-abdominis'],
        secondaryMuscleGroupIds: [],
        videoFilename: 'bicycle-crunches',
        coachingCue: '2-second tempo, 1-second squeeze per twist; drive shoulder (not elbow) to opposite knee.'
      },
      {
        id: 'reverse-crunch-abs-b',
        name: 'Reverse Crunch',
        sets: '2–3',
        reps: '10–15',
        primaryMuscles: ['Lower Rectus Abdominis'],
        secondaryMuscles: ['Hip Flexors'],
        primaryMuscleGroupIds: ['rectus-abdominis'],
        secondaryMuscleGroupIds: [],
        videoFilename: 'reverse-crunch',
        coachingCue: 'Controlled tailbone lift; avoid momentum on descent.'
      }
    ]
  },
  {
    id: 'day-5',
    dayNumber: 5,
    title: 'Lower B',
    focus: 'Posterior Chain & Quad Burnout',
    description: 'Heavy posterior chain hypertrophy coupled with quad isolation and spinal erectors.',
    exercises: [
      {
        id: 'rdl-lower-b',
        name: 'Romanian Deadlift (RDL)',
        sets: '3',
        reps: '8–10',
        primaryMuscles: ['Hamstrings'],
        secondaryMuscles: ['Gluteus Maximus', 'Erector Spinae'],
        primaryMuscleGroupIds: ['hamstrings'],
        secondaryMuscleGroupIds: ['glutes', 'lower-back'],
        videoFilename: 'rdl',
        coachingCue: 'Load the hips back, feel intense hamstring stretch, contract glutes to lockout.'
      },
      {
        id: 'seated-leg-curl-lower-b',
        name: 'Seated Leg Curl',
        sets: '3',
        reps: '10–12',
        primaryMuscles: ['Hamstrings (Knee Flexion)'],
        secondaryMuscles: ['Calves'],
        primaryMuscleGroupIds: ['hamstrings'],
        secondaryMuscleGroupIds: [],
        videoFilename: 'seated-leg-curl',
        coachingCue: 'Point toes slightly toward shin, slow 3-second negative descent.'
      },
      {
        id: 'leg-press-lower-b',
        name: 'Leg Press',
        sets: '3',
        reps: '8–10',
        primaryMuscles: ['Quadriceps'],
        secondaryMuscles: ['Glutes', 'Adductors'],
        primaryMuscleGroupIds: ['quads'],
        secondaryMuscleGroupIds: ['glutes', 'adductors'],
        videoFilename: 'leg-press',
        coachingCue: 'Feet shoulder-width on middle of plate; push through mid-foot without locking knees.'
      },
      {
        id: 'seated-leg-extension',
        name: 'Leg Extensions',
        sets: '3',
        reps: '12–15',
        primaryMuscles: ['Rectus Femoris & Quad Burnout'],
        secondaryMuscles: [],
        primaryMuscleGroupIds: ['quads'],
        secondaryMuscleGroupIds: [],
        videoFilename: 'seated-leg-extension',
        coachingCue: 'Pause for a full 1-second squeeze at apex lockout before descending slowly.'
      },
      {
        id: '45-degree-back-extension',
        name: '45-Degree Back Extensions',
        sets: '3',
        reps: '12–15',
        primaryMuscles: ['Erector Spinae', 'Gluteus Maximus'],
        secondaryMuscles: ['Upper Hamstrings'],
        primaryMuscleGroupIds: ['lower-back', 'glutes'],
        secondaryMuscleGroupIds: ['hamstrings'],
        videoFilename: '45-degree-back-extension',
        coachingCue: 'Hinge at hip, keep spine neutral or slightly rounded at top to isolate glutes/lower back.'
      }
    ]
  }
];

export function getEnrichedWorkoutProgram(program: WorkoutDay[] = workoutProgram): EnrichedWorkoutDay[] {
  return program.map((day) => ({
    ...day,
    exercises: day.exercises.map((exercise) => {
      const mediaKey = exercise.videoFilename.toLowerCase();
      const media = exerciseMediaMap[mediaKey] || exerciseMediaMap[exercise.id.toLowerCase()];
      return {
        ...exercise,
        media: media,
      };
    }),
  }));
}
