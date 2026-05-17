import { AiService } from './ai.service';

describe('AiService', () => {
  let prisma: {
    exercise: {
      findMany: jest.Mock;
    };
  };
  let service: AiService;

  beforeEach(() => {
    prisma = {
      exercise: {
        findMany: jest.fn(),
      },
    };

    service = new AiService(prisma as never);
  });

  it('returns only sanitized public and system exercises for AI training data', async () => {
    prisma.exercise.findMany.mockResolvedValue([
      {
        id: 'exercise-public',
        name: 'Push Up',
        description: 'Bodyweight chest press',
        muscleGroups: ['chest', 'arms'],
        equipment: 'bodyweight',
        difficulty: 'beginner',
        instructions: ['Brace core', 'Lower with control'],
        safetyNotes: ['Keep neck neutral'],
        visibility: 'public',
      },
    ]);

    const result = await service.getExerciseDataset();

    expect(prisma.exercise.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        visibility: { in: ['public', 'system'] },
      },
      orderBy: [{ visibility: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        muscleGroups: true,
        equipment: true,
        difficulty: true,
        instructions: true,
        safetyNotes: true,
        visibility: true,
      },
    });
    expect(result.data.exercises).toEqual([
      {
        id: 'exercise-public',
        name: 'Push Up',
        description: 'Bodyweight chest press',
        muscleGroups: ['chest', 'arms'],
        equipment: 'bodyweight',
        difficulty: 'beginner',
        instructions: ['Brace core', 'Lower with control'],
        safetyNotes: ['Keep neck neutral'],
        visibility: 'public',
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('ownerId');
  });
});
