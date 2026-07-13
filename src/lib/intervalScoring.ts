export interface IntervalAttemptResult {
  attempts: number;
  mistakes: number;
  score: number;
  firstTry: boolean;
  usedSample: boolean;
  selfVerified: boolean;
  usedShowAnswer: boolean;
}

export function scoreIntervalAttempt(
  mistakes: number,
  usedSample: boolean,
  selfVerified: boolean,
  usedShowAnswer: boolean,
): IntervalAttemptResult {
  const attempts = mistakes + 1;
  return {
    attempts,
    mistakes,
    score: usedShowAnswer ? 0 : Math.round(100 / attempts),
    firstTry: mistakes === 0,
    usedSample,
    selfVerified,
    usedShowAnswer,
  };
}
