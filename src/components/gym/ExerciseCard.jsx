// ExerciseCard.jsx
// Displays the current exercise during a gym session.
// Shows: exercise name, set progress, current weight, target reps.
// Large, high-contrast display — readable in gym lighting.

export default function ExerciseCard({ exercise, currentSet, totalSets, weight }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] leading-tight">
        {exercise.name}
      </h1>
      <p className="text-sm text-[var(--text-secondary)]">
        {totalSets} sets × {exercise.reps} reps @ {weight} lbs · Set {currentSet}
      </p>
    </div>
  )
}
