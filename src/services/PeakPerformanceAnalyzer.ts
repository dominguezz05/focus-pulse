import { HistoryDay } from "../storage";

export interface PeakAnalysis {
  bestHour: number;
  worstHour: number;
  peakDays: string[]; // ["Monday", "Wednesday"]
  averageScoreByHour: Map<number, number>;
  recommendation: string;
  insights: string[];
}

export interface HourlyStats {
  hour: number;
  avgScore: number;
  totalMinutes: number;
  sessionCount: number;
}

export class PeakPerformanceAnalyzer {
  private static instance: PeakPerformanceAnalyzer;

  static getInstance(): PeakPerformanceAnalyzer {
    if (!PeakPerformanceAnalyzer.instance) {
      PeakPerformanceAnalyzer.instance = new PeakPerformanceAnalyzer();
    }
    return PeakPerformanceAnalyzer.instance;
  }

  analyzePeakPerformance(history: HistoryDay[]): PeakAnalysis {
    const hourlyScores = new Map<number, number[]>();
    const hourlyMinutes = new Map<number, number>();
    const hourlySessions = new Map<number, number>();
    const dayOfWeekScores = new Map<string, number[]>();

    // Procesar historial
    history.forEach((day) => {
      const dayOfWeek = this.getDayOfWeek(day.date);
      const durationMinutes = day.totalTimeMs / (1000 * 60);

      // Acumular scores por día de la semana
      if (!dayOfWeekScores.has(dayOfWeek)) {
        dayOfWeekScores.set(dayOfWeek, []);
      }
      dayOfWeekScores.get(dayOfWeek)!.push(day.avgScore);

      // Sin datos horarios en el historial, usar hora actual como referencia
      // para que el mapa no quede vacío cuando se tiene al menos un día
      if (day.totalTimeMs > 0) {
        const hour = new Date(day.date + "T12:00:00").getHours();
        if (!hourlyScores.has(hour)) {
          hourlyScores.set(hour, []);
          hourlyMinutes.set(hour, 0);
          hourlySessions.set(hour, 0);
        }
        hourlyScores.get(hour)!.push(day.avgScore);
        hourlyMinutes.set(hour, hourlyMinutes.get(hour)! + durationMinutes);
        hourlySessions.set(hour, hourlySessions.get(hour)! + 1);
      }
    });

    // Calcular promedios por hora
    const hourlyAverages: [number, number][] = Array.from(
      hourlyScores.entries(),
    ).map(([hour, scores]) => {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      return [hour, avg];
    });

    // Ordenar por score (descendente)
    hourlyAverages.sort((a, b) => b[1] - a[1]);

    const bestHour = hourlyAverages.length > 0 ? hourlyAverages[0][0] : 9;
    const worstHour =
      hourlyAverages.length > 0
        ? hourlyAverages[hourlyAverages.length - 1][0]
        : 15;

    // Calcular mejores días de la semana
    const dayAverages = Array.from(dayOfWeekScores.entries()).map(
      ([day, scores]) => ({
        day,
        avg: scores.reduce((a, b) => a + b, 0) / scores.length,
      }),
    );
    dayAverages.sort((a, b) => b.avg - a.avg);
    const peakDays = dayAverages.slice(0, 2).map((d) => d.day);

    // Generar mapa de scores por hora
    const averageScoreByHour = new Map(hourlyAverages);

    // Generar recomendación
    const recommendation = this.generateRecommendation(
      bestHour,
      worstHour,
      peakDays,
      hourlyAverages,
    );

    // Generar insights adicionales
    const insights = this.generateInsights(
      hourlyAverages,
      hourlyMinutes,
      hourlySessions,
      dayAverages,
    );

    return {
      bestHour,
      worstHour,
      peakDays,
      averageScoreByHour,
      recommendation,
      insights,
    };
  }

  getHourlyStats(history: HistoryDay[]): HourlyStats[] {
    const hourlyData = new Map<
      number,
      { scores: number[]; minutes: number; sessions: number }
    >();

    history.forEach((day) => {
      if (day.totalTimeMs <= 0) return;

      const durationMinutes = day.totalTimeMs / (1000 * 60);
      const hour = new Date(day.date + "T12:00:00").getHours();

      if (!hourlyData.has(hour)) {
        hourlyData.set(hour, { scores: [], minutes: 0, sessions: 0 });
      }

      const data = hourlyData.get(hour)!;
      data.scores.push(day.avgScore);
      data.minutes += durationMinutes;
      data.sessions += 1;
    });

    return Array.from(hourlyData.entries())
      .map(([hour, data]) => ({
        hour,
        avgScore: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
        totalMinutes: Math.round(data.minutes),
        sessionCount: data.sessions,
      }))
      .sort((a, b) => a.hour - b.hour);
  }

  private getDayOfWeek(dateString: string): string {
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const date = new Date(dateString);
    return days[date.getDay()];
  }

  private generateRecommendation(
    bestHour: number,
    worstHour: number,
    peakDays: string[],
    hourlyAverages: [number, number][],
  ): string {
    const bestTime = this.formatHour(bestHour);
    const worstTime = this.formatHour(worstHour);

    const scoreDiff =
      hourlyAverages[0][1] - hourlyAverages[hourlyAverages.length - 1][1];

    if (scoreDiff > 20) {
      return `🎯 Your peak hour is ${bestTime}. Schedule complex tasks then. Avoid ${worstTime} for critical work.`;
    } else if (scoreDiff > 10) {
      return `💡 Better performance at ${bestTime}. Consider scheduling deep work during that time.`;
    } else {
      return `✨ Your performance is consistent throughout the day. Great balance!`;
    }
  }

  private generateInsights(
    hourlyAverages: [number, number][],
    hourlyMinutes: Map<number, number>,
    hourlySessions: Map<number, number>,
    dayAverages: { day: string; avg: number }[],
  ): string[] {
    const insights: string[] = [];

    // Insight 1: Hora más productiva
    if (hourlyAverages.length > 0) {
      const [bestHour, bestScore] = hourlyAverages[0];
      insights.push(
        `⏰ Your peak hour is ${this.formatHour(bestHour)} (average score: ${Math.round(bestScore)})`,
      );
    }

    // Insight 2: Patrón de energía
    const morningHours = hourlyAverages.filter(([h]) => h >= 6 && h < 12);
    const afternoonHours = hourlyAverages.filter(([h]) => h >= 12 && h < 18);
    const eveningHours = hourlyAverages.filter(([h]) => h >= 18 && h < 24);

    const morningAvg =
      morningHours.length > 0
        ? morningHours.reduce((sum, [, score]) => sum + score, 0) /
          morningHours.length
        : 0;
    const afternoonAvg =
      afternoonHours.length > 0
        ? afternoonHours.reduce((sum, [, score]) => sum + score, 0) /
          afternoonHours.length
        : 0;
    const eveningAvg =
      eveningHours.length > 0
        ? eveningHours.reduce((sum, [, score]) => sum + score, 0) /
          eveningHours.length
        : 0;

    const maxAvg = Math.max(morningAvg, afternoonAvg, eveningAvg);
    if (maxAvg === morningAvg && morningAvg > 0) {
      insights.push(
        "🌅 You're a morning person - make the most of your mornings",
      );
    } else if (maxAvg === afternoonAvg && afternoonAvg > 0) {
      insights.push(
        "☀️ Your peak energy is in the afternoon - plan accordingly",
      );
    } else if (maxAvg === eveningAvg && eveningAvg > 0) {
      insights.push("🌙 You're more productive at night - nocturnal owl");
    }

    // Insight 3: Mejores días
    if (dayAverages.length > 0) {
      const bestDay = dayAverages[0];
      insights.push(
        `📅 ${bestDay.day} is your most productive day (score: ${Math.round(bestDay.avg)})`,
      );
    }

    // Insight 4: Consistencia
    const allScores = hourlyAverages.map(([, score]) => score);
    const variance = this.calculateVariance(allScores);
    if (variance < 100) {
      insights.push(
        "📊 Your performance is very consistent throughout the day",
      );
    } else if (variance > 300) {
      insights.push(
        "📊 Your performance varies a lot - optimize your work schedule",
      );
    }

    // Insight 5: Tiempo trabajado por hora
    const totalMinutes = Array.from(hourlyMinutes.values()).reduce(
      (a, b) => a + b,
      0,
    );
    const totalSessions = Array.from(hourlySessions.values()).reduce(
      (a, b) => a + b,
      0,
    );
    const avgSessionDuration = totalMinutes / totalSessions;

    if (avgSessionDuration < 25) {
      insights.push(
        "⏱️ Your sessions are short - consider longer focused blocks",
      );
    } else if (avgSessionDuration > 60) {
      insights.push(
        "⏱️ Your sessions are long - remember to take regular breaks",
      );
    }

    return insights;
  }

  private calculateVariance(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    const squaredDiffs = numbers.map((n) => Math.pow(n - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
  }

  private formatHour(hour: number): string {
    const period = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:00 ${period}`;
  }

  // Método para obtener recomendación rápida sin todo el análisis
  getQuickRecommendation(history: HistoryDay[]): string | null {
    if (history.length < 3) {
      return null; // No hay suficientes datos
    }

    const analysis = this.analyzePeakPerformance(history);
    return analysis.recommendation;
  }

  // Método para saber si es un buen momento para trabajar
  isGoodTimeToWork(hour: number, history: HistoryDay[]): boolean {
    if (history.length < 3) return true; // Sin datos, asumimos que sí

    const analysis = this.analyzePeakPerformance(history);
    const avgScore = analysis.averageScoreByHour.get(hour) || 0;

    // Es buen momento si el score está por encima del promedio general
    const allScores = Array.from(analysis.averageScoreByHour.values());
    const overallAvg = allScores.reduce((a, b) => a + b, 0) / allScores.length;

    return avgScore >= overallAvg;
  }
}
