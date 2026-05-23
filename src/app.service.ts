import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  getDashboardHome(): {
    message: string;
    data: {
      home: {
        greetingLine: string;
        athleteAlias: string;
        readinessScore: number;
        readinessMessage: string;
        volumeValue: string;
        volumeUnit: string;
        streakDays: number;
      };
    };
  } {
    return {
      message: 'Dashboard home summary fetched successfully',
      data: {
        home: {
          greetingLine: this.buildGreetingLine(),
          athleteAlias: 'Champ',
          readinessScore: 78,
          readinessMessage:
            'Backend synced. Recovery-adjusted plan is ready for today.',
          volumeValue: '13.1k',
          volumeUnit: 'lbs lifted',
          streakDays: 14,
        },
      },
    };
  }

  private buildGreetingLine(): string {
    const currentHour = new Date().getHours();

    if (currentHour < 12) {
      return 'Good morning';
    }
    if (currentHour < 18) {
      return 'Good afternoon';
    }
    return 'Good evening';
  }
}
