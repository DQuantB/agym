import { describe, expect, it } from 'vitest';
import { applyWorkoutCorrection, buildCanonicalConfirmationPayload, type CaptureDraft, type DraftFields } from './captureApi';

const fields: DraftFields = { kind: 'workout', exercises: [{ name: 'Squat', sets: [{ reps: 8, weightKg: 80, rpe: null }, { reps: 6, weightKg: 82.5, rpe: null }] }, { name: 'Row', sets: [{ reps: 10, weightKg: 50, rpe: null }] }] };

const draft: CaptureDraft = { id: 'draft-1', rawLogId: 'raw-1', fields, safetyFlags: [], status: 'parsed', parserVersion: 'deterministic-v1' };

describe('capture correction helpers', () => {
  it('changes only the selected exercise and set without mutating input', () => {
    const corrected = applyWorkoutCorrection(fields, 0, 1, { name: 'Back squat', reps: 7, weightKg: 85 });
    expect(corrected).not.toBe(fields);
    expect(corrected.exercises?.[0]).toEqual({ name: 'Back squat', sets: [{ reps: 8, weightKg: 80, rpe: null }, { reps: 7, weightKg: 85, rpe: null }] });
    expect(corrected.exercises?.[1]).toEqual(fields.exercises?.[1]);
    expect(fields.exercises?.[0].sets[1]).toEqual({ reps: 6, weightKg: 82.5, rpe: null });
  });

  it('builds a user-confirmed payload linked to both source records', () => {
    const payload = buildCanonicalConfirmationPayload({ userId: 'user-1', clientId: 'client-1', draft, originalFields: fields });
    expect(payload).toMatchObject({ user_id: 'user-1', client_id: 'client-1', source_raw_log_id: 'raw-1', source_parse_draft_id: 'draft-1', provenance: 'user_confirmed', final_fields: fields });
    expect(payload.correction_diff).toBeNull();
  });
});
