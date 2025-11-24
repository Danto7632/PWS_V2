import type { Evaluation } from '../types';

type Props = {
  evaluation: Evaluation | null;
};

export function EvaluationPanel({ evaluation }: Props) {
  if (!evaluation) return null;

  const scorePercent = Math.round((evaluation.score / evaluation.maxScore) * 100);

  return (
    <div className="evaluation-panel">
      <div className="evaluation-header">
        <h3>📊 응답 평가</h3>
        <span className="score-chip">
          {evaluation.score}/{evaluation.maxScore} ({scorePercent}%)
        </span>
      </div>
      <textarea value={evaluation.feedback} readOnly rows={8} />
    </div>
  );
}
