import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  ExerciseDifficulty,
  PrismaClient,
  Visibility,
  type Prisma,
} from '@prisma/client';

type SeedExercise = Prisma.ExerciseUncheckedCreateInput & {
  id: string;
};

const beginnerExercises: SeedExercise[] = [
  {
    id: 'system-bodyweight-squat',
    name: 'Bodyweight Squat',
    description:
      'A beginner lower-body movement for learning squat depth, balance, and leg control without equipment.',
    muscleGroups: ['legs', 'core'],
    equipment: 'bodyweight',
    difficulty: ExerciseDifficulty.beginner,
    instructions: [
      'Stand with feet about shoulder-width apart.',
      'Lower your hips back and down while keeping your chest tall.',
      'Drive through the whole foot to stand back up.',
    ],
    safetyNotes: [
      'Keep knees tracking in the same direction as your toes.',
      'Stop higher if your lower back rounds.',
    ],
    visibility: Visibility.system,
  },
  {
    id: 'system-wall-push-up',
    name: 'Wall Push-up',
    description:
      'A low-load push-up variation that helps beginners build pressing strength and shoulder control.',
    muscleGroups: ['chest', 'shoulders', 'arms'],
    equipment: 'bodyweight',
    difficulty: ExerciseDifficulty.beginner,
    instructions: [
      'Place both hands on a wall at chest height.',
      'Step back until your body forms a straight line.',
      'Bend your elbows, move toward the wall, then press away.',
    ],
    safetyNotes: [
      'Keep ribs stacked over hips.',
      'Use a higher hand position if wrists feel uncomfortable.',
    ],
    visibility: Visibility.system,
  },
  {
    id: 'system-incline-push-up',
    name: 'Incline Push-up',
    description:
      'A scalable push-up variation using a bench or box to train chest, shoulders, and triceps.',
    muscleGroups: ['chest', 'shoulders', 'arms'],
    equipment: 'bodyweight',
    difficulty: ExerciseDifficulty.beginner,
    instructions: [
      'Place hands on a stable bench slightly wider than shoulders.',
      'Keep a straight line from head to heels.',
      'Lower with control and press back to the start.',
    ],
    safetyNotes: [
      'Use a higher surface to reduce difficulty.',
      'Avoid shrugging shoulders toward ears.',
    ],
    visibility: Visibility.system,
  },
  {
    id: 'system-knee-push-up',
    name: 'Knee Push-up',
    description:
      'A beginner pressing movement that builds push-up strength with reduced bodyweight load.',
    muscleGroups: ['chest', 'shoulders', 'arms'],
    equipment: 'bodyweight',
    difficulty: ExerciseDifficulty.beginner,
    instructions: [
      'Set hands slightly wider than shoulders and knees on the floor.',
      'Keep hips forward so the body stays long.',
      'Lower the chest with control, then press the floor away.',
    ],
    safetyNotes: [
      'Do not let the lower back sag.',
      'Stop if shoulder pain appears.',
    ],
    visibility: Visibility.system,
  },
  {
    id: 'system-glute-bridge',
    name: 'Glute Bridge',
    description:
      'A beginner hip-extension drill for glutes, hamstrings, and pelvic control.',
    muscleGroups: ['legs', 'core'],
    equipment: 'bodyweight',
    difficulty: ExerciseDifficulty.beginner,
    instructions: [
      'Lie on your back with knees bent and feet flat.',
      'Brace lightly and lift hips until shoulders, hips, and knees align.',
      'Pause, then lower with control.',
    ],
    safetyNotes: [
      'Avoid arching through the lower back.',
      'Keep feet planted throughout the rep.',
    ],
    visibility: Visibility.system,
  },
  {
    id: 'system-forearm-plank',
    name: 'Forearm Plank',
    description:
      'A simple core stability hold for learning bracing and full-body tension.',
    muscleGroups: ['core', 'full_body'],
    equipment: 'bodyweight',
    difficulty: ExerciseDifficulty.beginner,
    instructions: [
      'Place elbows under shoulders and step feet back.',
      'Squeeze glutes and keep ribs down.',
      'Hold a straight line while breathing steadily.',
    ],
    safetyNotes: [
      'End the set if the lower back starts to sag.',
      'Keep neck relaxed and eyes toward the floor.',
    ],
    visibility: Visibility.system,
  },
  {
    id: 'system-dead-bug',
    name: 'Dead Bug',
    description:
      'A beginner core drill that teaches trunk control while the arms and legs move.',
    muscleGroups: ['core'],
    equipment: 'bodyweight',
    difficulty: ExerciseDifficulty.beginner,
    instructions: [
      'Lie on your back with arms up and knees over hips.',
      'Lower opposite arm and leg while keeping your back still.',
      'Return to center and switch sides.',
    ],
    safetyNotes: [
      'Only lower as far as you can without your back arching.',
      'Move slowly instead of rushing reps.',
    ],
    visibility: Visibility.system,
  },
  {
    id: 'system-bird-dog',
    name: 'Bird Dog',
    description:
      'A beginner core and back control drill for balance, bracing, and hip stability.',
    muscleGroups: ['core', 'back'],
    equipment: 'bodyweight',
    difficulty: ExerciseDifficulty.beginner,
    instructions: [
      'Start on hands and knees with a neutral spine.',
      'Reach one arm forward and the opposite leg back.',
      'Pause, return, and repeat on the other side.',
    ],
    safetyNotes: [
      'Keep hips level instead of rotating open.',
      'Use a shorter reach if balance is difficult.',
    ],
    visibility: Visibility.system,
  },
  {
    id: 'system-step-up',
    name: 'Step-up',
    description:
      'A beginner single-leg movement for legs, balance, and everyday strength.',
    muscleGroups: ['legs', 'core'],
    equipment: 'bodyweight',
    difficulty: ExerciseDifficulty.beginner,
    instructions: [
      'Place one foot fully on a stable step or box.',
      'Drive through the front foot to stand tall.',
      'Step down slowly and repeat before switching sides.',
    ],
    safetyNotes: [
      'Use a lower step if the knee caves inward.',
      'Hold a rail lightly if balance is limited.',
    ],
    visibility: Visibility.system,
  },
  {
    id: 'system-reverse-lunge',
    name: 'Reverse Lunge',
    description:
      'A beginner-friendly lunge variation that trains legs with less forward knee stress.',
    muscleGroups: ['legs', 'core'],
    equipment: 'bodyweight',
    difficulty: ExerciseDifficulty.beginner,
    instructions: [
      'Stand tall, then step one foot backward.',
      'Lower until both knees bend with control.',
      'Push through the front foot to return to standing.',
    ],
    safetyNotes: [
      'Keep the front knee tracking over the middle toes.',
      'Shorten range if balance or knee comfort is limited.',
    ],
    visibility: Visibility.system,
  },
  {
    id: 'system-dumbbell-goblet-squat',
    name: 'Dumbbell Goblet Squat',
    description:
      'A beginner loaded squat using one dumbbell held at the chest.',
    muscleGroups: ['legs', 'core'],
    equipment: 'dumbbell',
    difficulty: ExerciseDifficulty.beginner,
    instructions: [
      'Hold one dumbbell vertically at chest height.',
      'Squat down while keeping elbows close and chest tall.',
      'Stand up by pushing the floor away.',
    ],
    safetyNotes: [
      'Choose a weight that lets you control every rep.',
      'Avoid collapsing knees inward.',
    ],
    visibility: Visibility.system,
  },
  {
    id: 'system-dumbbell-romanian-deadlift',
    name: 'Dumbbell Romanian Deadlift',
    description:
      'A beginner hinge movement for hamstrings, glutes, and back position control.',
    muscleGroups: ['legs', 'back'],
    equipment: 'dumbbell',
    difficulty: ExerciseDifficulty.beginner,
    instructions: [
      'Hold dumbbells in front of your thighs.',
      'Push hips back while keeping a soft bend in the knees.',
      'Stand tall when you feel the hamstrings stretch.',
    ],
    safetyNotes: [
      'Keep the weights close to your legs.',
      'Stop before your back rounds.',
    ],
    visibility: Visibility.system,
  },
  {
    id: 'system-dumbbell-floor-press',
    name: 'Dumbbell Floor Press',
    description:
      'A beginner chest press variation with a stable floor range of motion.',
    muscleGroups: ['chest', 'shoulders', 'arms'],
    equipment: 'dumbbell',
    difficulty: ExerciseDifficulty.beginner,
    instructions: [
      'Lie on the floor with a dumbbell in each hand.',
      'Start with upper arms resting lightly on the floor.',
      'Press dumbbells up, then lower with control.',
    ],
    safetyNotes: [
      'Keep wrists stacked over elbows.',
      'Use light weights until the path feels stable.',
    ],
    visibility: Visibility.system,
  },
  {
    id: 'system-one-arm-dumbbell-row',
    name: 'One-arm Dumbbell Row',
    description:
      'A beginner pulling movement for the back using one dumbbell and a stable support.',
    muscleGroups: ['back', 'arms'],
    equipment: 'dumbbell',
    difficulty: ExerciseDifficulty.beginner,
    instructions: [
      'Support one hand on a bench or stable surface.',
      'Pull the dumbbell toward your hip.',
      'Lower slowly until the arm is long again.',
    ],
    safetyNotes: [
      'Keep the torso still and avoid twisting.',
      'Do not yank the weight with momentum.',
    ],
    visibility: Visibility.system,
  },
  {
    id: 'system-dumbbell-shoulder-press',
    name: 'Dumbbell Shoulder Press',
    description:
      'A beginner overhead press for shoulders and triceps using manageable dumbbells.',
    muscleGroups: ['shoulders', 'arms'],
    equipment: 'dumbbell',
    difficulty: ExerciseDifficulty.beginner,
    instructions: [
      'Hold dumbbells at shoulder height.',
      'Brace your core and press both weights overhead.',
      'Lower back to shoulders with control.',
    ],
    safetyNotes: [
      'Avoid leaning backward to finish reps.',
      'Use a seated version if standing feels unstable.',
    ],
    visibility: Visibility.system,
  },
  {
    id: 'system-dumbbell-bicep-curl',
    name: 'Dumbbell Bicep Curl',
    description: 'A simple arm exercise for learning controlled elbow flexion.',
    muscleGroups: ['arms'],
    equipment: 'dumbbell',
    difficulty: ExerciseDifficulty.beginner,
    instructions: [
      'Stand tall with dumbbells at your sides.',
      'Curl the weights up without swinging.',
      'Lower slowly until elbows are straight again.',
    ],
    safetyNotes: [
      'Keep elbows close to the body.',
      'Pick a weight that does not require leaning back.',
    ],
    visibility: Visibility.system,
  },
  {
    id: 'system-dumbbell-triceps-extension',
    name: 'Dumbbell Triceps Extension',
    description:
      'A beginner arm movement for training the triceps with one light dumbbell.',
    muscleGroups: ['arms', 'shoulders'],
    equipment: 'dumbbell',
    difficulty: ExerciseDifficulty.beginner,
    instructions: [
      'Hold one dumbbell with both hands overhead.',
      'Bend elbows to lower the weight behind your head.',
      'Extend elbows to return to the top.',
    ],
    safetyNotes: [
      'Keep ribs down and avoid over-arching.',
      'Use a lighter weight if elbows feel strained.',
    ],
    visibility: Visibility.system,
  },
  {
    id: 'system-band-pull-apart',
    name: 'Band Pull-apart',
    description:
      'A beginner upper-back and shoulder control drill using a resistance band.',
    muscleGroups: ['back', 'shoulders'],
    equipment: 'band',
    difficulty: ExerciseDifficulty.beginner,
    instructions: [
      'Hold a band at chest height with straight arms.',
      'Pull hands apart until the band reaches the chest.',
      'Return slowly without losing posture.',
    ],
    safetyNotes: [
      'Keep shoulders down away from ears.',
      'Use a lighter band if range of motion is limited.',
    ],
    visibility: Visibility.system,
  },
  {
    id: 'system-band-row',
    name: 'Band Row',
    description:
      'A beginner pulling movement for the back using a resistance band.',
    muscleGroups: ['back', 'arms'],
    equipment: 'band',
    difficulty: ExerciseDifficulty.beginner,
    instructions: [
      'Anchor a band around a stable point.',
      'Pull handles toward your ribs while keeping chest tall.',
      'Slowly return to straight arms.',
    ],
    safetyNotes: [
      'Check that the anchor point is secure.',
      'Do not let the band snap back quickly.',
    ],
    visibility: Visibility.system,
  },
  {
    id: 'system-lat-pulldown',
    name: 'Lat Pulldown',
    description:
      'A beginner machine pull for building back strength with adjustable load.',
    muscleGroups: ['back', 'arms'],
    equipment: 'machine',
    difficulty: ExerciseDifficulty.beginner,
    instructions: [
      'Sit tall and grip the bar wider than shoulders.',
      'Pull the bar toward your upper chest.',
      'Control the bar back to the top.',
    ],
    safetyNotes: [
      'Avoid pulling behind the neck.',
      'Keep ribs down and avoid leaning far backward.',
    ],
    visibility: Visibility.system,
  },
  {
    id: 'system-seated-leg-press',
    name: 'Seated Leg Press',
    description:
      'A beginner machine leg exercise with stable support and adjustable load.',
    muscleGroups: ['legs'],
    equipment: 'machine',
    difficulty: ExerciseDifficulty.beginner,
    instructions: [
      'Set feet hip-width on the platform.',
      'Lower the platform until knees bend comfortably.',
      'Press through the whole foot without locking knees hard.',
    ],
    safetyNotes: [
      'Keep lower back against the pad.',
      'Do not let knees cave inward.',
    ],
    visibility: Visibility.system,
  },
  {
    id: 'system-chest-press-machine',
    name: 'Chest Press Machine',
    description: 'A beginner machine press for chest, shoulders, and triceps.',
    muscleGroups: ['chest', 'shoulders', 'arms'],
    equipment: 'machine',
    difficulty: ExerciseDifficulty.beginner,
    instructions: [
      'Adjust handles to chest height.',
      'Press forward until arms are almost straight.',
      'Return handles slowly with control.',
    ],
    safetyNotes: [
      'Keep shoulders relaxed against the pad.',
      'Use a load you can control both directions.',
    ],
    visibility: Visibility.system,
  },
  {
    id: 'system-seated-cable-row',
    name: 'Seated Cable Row',
    description: 'A beginner cable pull for back strength and posture control.',
    muscleGroups: ['back', 'arms'],
    equipment: 'cable',
    difficulty: ExerciseDifficulty.beginner,
    instructions: [
      'Sit tall with feet planted and arms extended.',
      'Pull the handle toward your lower ribs.',
      'Pause briefly, then return with control.',
    ],
    safetyNotes: [
      'Avoid rounding your lower back.',
      'Keep elbows close instead of flaring hard.',
    ],
    visibility: Visibility.system,
  },
  {
    id: 'system-cable-face-pull',
    name: 'Cable Face Pull',
    description:
      'A shoulder-friendly cable pull for upper back and rear delts.',
    muscleGroups: ['back', 'shoulders'],
    equipment: 'cable',
    difficulty: ExerciseDifficulty.beginner,
    instructions: [
      'Set the cable near face height and grip the rope.',
      'Pull rope ends toward the sides of your face.',
      'Return slowly while keeping posture tall.',
    ],
    safetyNotes: [
      'Use light load and smooth control.',
      'Stop if shoulders pinch.',
    ],
    visibility: Visibility.system,
  },
  {
    id: 'system-kettlebell-deadlift',
    name: 'Kettlebell Deadlift',
    description:
      'A beginner hinge pattern using a kettlebell placed between the feet.',
    muscleGroups: ['legs', 'back'],
    equipment: 'kettlebell',
    difficulty: ExerciseDifficulty.beginner,
    instructions: [
      'Stand with the kettlebell between your feet.',
      'Hinge hips back and grip the handle.',
      'Stand tall by driving through your feet and squeezing glutes.',
    ],
    safetyNotes: [
      'Keep the kettlebell close to your body.',
      'Do not lift if your back rounds.',
    ],
    visibility: Visibility.system,
  },
  {
    id: 'system-kettlebell-goblet-squat',
    name: 'Kettlebell Goblet Squat',
    description:
      'A beginner loaded squat using a kettlebell held close to the chest.',
    muscleGroups: ['legs', 'core'],
    equipment: 'kettlebell',
    difficulty: ExerciseDifficulty.beginner,
    instructions: [
      'Hold the kettlebell by the horns at chest height.',
      'Squat down while keeping the weight close.',
      'Stand back up with controlled balance.',
    ],
    safetyNotes: [
      'Keep heels down through the movement.',
      'Choose a weight that keeps the torso stable.',
    ],
    visibility: Visibility.system,
  },
  {
    id: 'system-barbell-box-squat',
    name: 'Barbell Box Squat',
    description:
      'A beginner barbell squat variation using a box to guide consistent depth.',
    muscleGroups: ['legs', 'core'],
    equipment: 'barbell',
    difficulty: ExerciseDifficulty.beginner,
    instructions: [
      'Set a box behind you and place the bar securely on your upper back.',
      'Sit back to touch the box lightly.',
      'Stand up by driving through the floor.',
    ],
    safetyNotes: [
      'Start with an empty bar if you are new.',
      'Use rack safety bars when available.',
    ],
    visibility: Visibility.system,
  },
  {
    id: 'system-barbell-bench-press',
    name: 'Barbell Bench Press',
    description:
      'A classic chest press for users ready to learn barbell control with a spotter or safety setup.',
    muscleGroups: ['chest', 'shoulders', 'arms'],
    equipment: 'barbell',
    difficulty: ExerciseDifficulty.intermediate,
    instructions: [
      'Lie on a bench with feet planted.',
      'Lower the bar to the lower chest with control.',
      'Press up while keeping shoulders stable.',
    ],
    safetyNotes: [
      'Use a spotter or safety arms.',
      'Do not bounce the bar off the chest.',
    ],
    visibility: Visibility.system,
  },
  {
    id: 'system-assisted-pull-up',
    name: 'Assisted Pull-up',
    description:
      'A beginner-friendly vertical pull using assistance to build back and arm strength.',
    muscleGroups: ['back', 'arms'],
    equipment: 'machine',
    difficulty: ExerciseDifficulty.beginner,
    instructions: [
      'Set assistance so reps feel controlled.',
      'Pull chest toward the handles while keeping ribs down.',
      'Lower until arms are long again.',
    ],
    safetyNotes: [
      'Step on and off the assistance platform carefully.',
      'Avoid swinging through reps.',
    ],
    visibility: Visibility.system,
  },
  {
    id: 'system-treadmill-walk',
    name: 'Treadmill Walk',
    description:
      'A simple low-impact conditioning option for warm-ups, recovery, and beginner cardio.',
    muscleGroups: ['full_body', 'legs'],
    equipment: 'machine',
    difficulty: ExerciseDifficulty.beginner,
    instructions: [
      'Start at an easy walking pace.',
      'Keep posture tall and hands relaxed.',
      'Increase speed or incline only if breathing stays controlled.',
    ],
    safetyNotes: [
      'Use the safety clip when available.',
      'Slow down before stepping off.',
    ],
    visibility: Visibility.system,
  },
  {
    id: 'system-jumping-jack',
    name: 'Jumping Jack',
    description:
      'A simple full-body conditioning drill for warm-ups and short cardio intervals.',
    muscleGroups: ['full_body'],
    equipment: 'bodyweight',
    difficulty: ExerciseDifficulty.beginner,
    instructions: [
      'Stand tall with arms at sides.',
      'Jump feet out while raising arms overhead.',
      'Jump back to the start with a light landing.',
    ],
    safetyNotes: [
      'Use step jacks if jumping is uncomfortable.',
      'Land softly and keep knees relaxed.',
    ],
    visibility: Visibility.system,
  },
  {
    id: 'system-farmers-carry',
    name: 'Farmer Carry',
    description:
      'A full-body loaded carry for grip, posture, and core stability.',
    muscleGroups: ['full_body', 'core', 'arms'],
    equipment: 'dumbbell',
    difficulty: ExerciseDifficulty.beginner,
    instructions: [
      'Hold one dumbbell in each hand.',
      'Stand tall with shoulders down and ribs stacked.',
      'Walk slowly for the target distance or time.',
    ],
    safetyNotes: [
      'Choose weights you can carry without leaning.',
      'Keep the path clear before walking.',
    ],
    visibility: Visibility.system,
  },
];

async function main() {
  loadEnvFile(resolve(__dirname, '..', '.env'));
  const prisma = new PrismaClient({
    datasources: {
      db: { url: resolveDatabaseUrl() },
    },
  });

  for (const exercise of beginnerExercises) {
    await prisma.exercise.upsert({
      where: { id: exercise.id },
      create: exercise,
      update: {
        name: exercise.name,
        description: exercise.description,
        muscleGroups: exercise.muscleGroups,
        equipment: exercise.equipment,
        difficulty: exercise.difficulty,
        instructions: exercise.instructions,
        safetyNotes: exercise.safetyNotes,
        videoUrl: exercise.videoUrl,
        imageUrl: exercise.imageUrl,
        visibility: Visibility.system,
        ownerId: null,
        deletedAt: null,
      },
    });
  }

  await prisma.$disconnect();
  console.log(`Seeded ${beginnerExercises.length} system exercises.`);
}

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;

  const content = readFileSync(path, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (!key || process.env[key] !== undefined) continue;

    process.env[key] = unquoteEnvValue(rawValue);
  }
}

function unquoteEnvValue(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function resolveDatabaseUrl() {
  const directUrl = process.env.DATABASE_URL?.trim();
  if (directUrl) return directUrl;

  const host = process.env.DB_HOST?.trim();
  const database = process.env.DB_NAME?.trim();
  const user = process.env.DB_USER?.trim();

  if (!host || !database || !user) {
    throw new Error(
      'Database env is missing. Set DATABASE_URL or DB_HOST, DB_NAME, and DB_USER.',
    );
  }

  const port = process.env.DB_PORT?.trim() || '5432';
  const password = process.env.DB_PASSWORD ?? '';
  const schema = process.env.DB_SCHEMA?.trim() || 'public';

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(
    password,
  )}@${host}:${port}/${database}?schema=${encodeURIComponent(schema)}`;
}

main().catch(async (error: unknown) => {
  console.error(error);
  process.exit(1);
});
