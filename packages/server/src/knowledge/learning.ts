import fs from 'node:fs/promises';
import path from 'node:path';
import type { LearningRecord, LearningState, MasteryLevel } from '@pixelweb/shared';

/**
 * Learning records, inspired by the teach skill's `learning-records/`:
 * what has been seen, what has been quizzed, what is mastered.
 * Persisted as one JSON file in the data dir (not inside the user's project).
 */
export class LearningStore {
  private state: LearningState = { records: {}, updatedAt: 0 };
  private readonly file: string;

  constructor(dataDir: string) {
    this.file = path.join(dataDir, 'learning.json');
  }

  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.file, 'utf8');
      const parsed = JSON.parse(raw) as LearningState;
      if (parsed && typeof parsed === 'object' && parsed.records) this.state = parsed;
    } catch {
      /* first run */
    }
  }

  get(): LearningState {
    return this.state;
  }

  private record(cardId: string): LearningRecord {
    return (this.state.records[cardId] ??= {
      cardId,
      mastery: 'seen',
      seenCount: 0,
      lastSeen: 0,
      quizCorrect: 0,
      quizTotal: 0,
    });
  }

  async markSeen(cardId: string): Promise<LearningState> {
    const r = this.record(cardId);
    r.seenCount++;
    r.lastSeen = Date.now();
    return this.save();
  }

  async recordQuiz(cardId: string, correct: boolean): Promise<LearningState> {
    const r = this.record(cardId);
    r.quizTotal++;
    if (correct) r.quizCorrect++;
    // retrieval practice: 3 correct answers in a row-ish → mastered, a miss drops back to learning
    if (!correct) r.mastery = 'learning';
    else if (r.quizCorrect >= 3 && r.quizCorrect / r.quizTotal >= 0.7) r.mastery = 'mastered';
    else if (r.mastery === 'seen') r.mastery = 'learning';
    return this.save();
  }

  async setMastery(cardId: string, mastery: MasteryLevel): Promise<LearningState> {
    this.record(cardId).mastery = mastery;
    return this.save();
  }

  async setNotes(cardId: string, notes: string): Promise<LearningState> {
    this.record(cardId).notes = notes;
    return this.save();
  }

  private async save(): Promise<LearningState> {
    this.state.updatedAt = Date.now();
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(this.state, null, 2));
    return this.state;
  }
}
