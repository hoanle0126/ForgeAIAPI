import { Injectable } from '@nestjs/common';
import { Visibility } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiService {
  constructor(private readonly prisma: PrismaService) {}

  async getExerciseDataset() {
    const exercises = await this.prisma.exercise.findMany({
      where: {
        deletedAt: null,
        visibility: { in: [Visibility.public, Visibility.system] },
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

    return {
      message: 'AI exercise dataset fetched successfully',
      data: { exercises },
    };
  }
}
