// useSession.js
// Manages gym session state machine.
// States: IDLE | PRE_SESSION | CONFIRM_WEIGHT | SET_ACTIVE | REST | SESSION_COMPLETE
//
// Flow:
//   mount → start() → PRE_SESSION (workout preview)
//                   → SESSION_COMPLETE (if already done today)
//   user clicks "Start workout" → beginSession() → CONFIRM_WEIGHT
//   user clicks "Start session" → confirmWeights() → SET_ACTIVE
//   log sets → REST → SET_ACTIVE → ... → SESSION_COMPLETE (saves + feedback)
//   user clicks "End workout" mid-session → endEarly() → SESSION_COMPLETE (saves + feedback)
//
// On SESSION_COMPLETE: persists session to Supabase with workout_name + triggers feedback.
// Skipped/unstarted sets are logged as 0 reps.

import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { callFeedback, isRateLimitError } from '../lib/claude'
import { localDateStr } from '../lib/dates'

function pickDayIndex(sessionCount, days) {
  return sessionCount % days.length
}

export function useSession(userId) {
  const [state,         setState]         = useState('IDLE')
  const [exercises,     setExercises]     = useState([])  // today's exercises (with possibly adjusted weights)
  const [exerciseIndex, setExerciseIndex] = useState(0)
  const [setIndex,      setSetIndex]      = useState(0)
  const [loggedSets,    setLoggedSets]    = useState([])  // { name, reps, weight_lbs }[]
  const [dayLabel,      setDayLabel]      = useState('')
  const [feedback,        setFeedback]        = useState(null)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [isLoading,       setIsLoading]       = useState(false)
  const [alreadyDoneToday, setAlreadyDoneToday] = useState(false)
  const [isRestDay,        setIsRestDay]        = useState(false)

  // Refs keep current values accessible inside SESSION_COMPLETE effect without stale closures
  const loggedSetsRef   = useRef(loggedSets)
  const exercisesRef    = useRef(exercises)
  const dayLabelRef     = useRef(dayLabel)
  const exerciseIdxRef  = useRef(exerciseIndex)
  const setIdxRef       = useRef(setIndex)

  useEffect(() => { loggedSetsRef.current  = loggedSets   }, [loggedSets])
  useEffect(() => { exercisesRef.current   = exercises     }, [exercises])
  useEffect(() => { dayLabelRef.current    = dayLabel      }, [dayLabel])
  useEffect(() => { exerciseIdxRef.current = exerciseIndex }, [exerciseIndex])
  useEffect(() => { setIdxRef.current      = setIndex      }, [setIndex])

  // start() — fetch program + check today's completion, go to PRE_SESSION or SESSION_COMPLETE
  const start = useCallback(async () => {
    setIsLoading(true)
    const todayStr = localDateStr()

    const [memRes, sessionsRes, todayRes] = await Promise.all([
      supabase.from('memory').select('current_program').eq('user_id', userId).maybeSingle(),
      supabase.from('sessions').select('id').eq('user_id', userId).eq('completed', true),
      supabase.from('sessions').select('id').eq('user_id', userId).eq('date', todayStr).eq('completed', true).maybeSingle(),
    ])
    setIsLoading(false)

    if (memRes.error) console.error('[useSession] memory fetch error:', memRes.error)

    // Already completed today — show completion screen without re-logging
    if (todayRes.data) {
      setAlreadyDoneToday(true)
      setState('SESSION_COMPLETE')
      return
    }

    const program      = memRes.data?.current_program
    const sessionCount = sessionsRes.data?.length ?? 0

    if (!program?.days?.length) {
      setExercises([])
      setDayLabel('Workout')
      setState('PRE_SESSION')
      return
    }

    // Check if today is a rest day per the program schedule
    const todayDow   = new Date().getDay()
    const schedEntry = program.schedule?.[todayDow]

    if (program.schedule && !schedEntry) {
      setIsRestDay(true)
      setState('PRE_SESSION')
      return
    }

    // Use schedule day_index if available, otherwise fall back to session count rotation
    const dayIdx = schedEntry?.day_index ?? pickDayIndex(sessionCount, program.days)
    const day    = program.days[dayIdx]

    // Guard against a malformed program (out-of-range day_index, or a day with
    // no exercises) — fall back to the "no program yet" preview rather than
    // crashing the gym screen.
    if (!day?.exercises?.length) {
      setExercises([])
      setDayLabel('Workout')
      setState('PRE_SESSION')
      return
    }

    setDayLabel(day.label ?? `Day ${dayIdx + 1}`)
    // Normalize each exercise so the set machine can't divide on undefined:
    // sets must be a positive integer; reps/weight default sensibly.
    setExercises(day.exercises.map(ex => ({
      ...ex,
      sets:       Number.isFinite(+ex.sets) && +ex.sets > 0 ? Math.floor(+ex.sets) : 1,
      reps:       Number.isFinite(+ex.reps) ? +ex.reps : 8,
      weight_lbs: Number.isFinite(+ex.weight_lbs) ? +ex.weight_lbs : 0,
    })))
    setState('PRE_SESSION')
  }, [userId])

  // beginSession() — PRE_SESSION → CONFIRM_WEIGHT
  const beginSession = useCallback(() => {
    setState('CONFIRM_WEIGHT')
  }, [])

  // updateWeight — called during CONFIRM_WEIGHT when user adjusts a weight
  const updateWeight = useCallback((idx, weight_lbs) => {
    setExercises(prev => prev.map((ex, i) => i === idx ? { ...ex, weight_lbs } : ex))
  }, [])

  // confirmWeights — CONFIRM_WEIGHT → SET_ACTIVE
  const confirmWeights = useCallback(() => {
    setExerciseIndex(0)
    setSetIndex(0)
    setLoggedSets([])
    setState('SET_ACTIVE')
  }, [])

  // logSet — record reps for the current set
  const logSet = useCallback((reps) => {
    const ex = exercises[exerciseIndex]
    if (!ex) return // defensive: nothing to log against

    setLoggedSets(prev => [...prev, { name: ex.name, reps, weight_lbs: ex.weight_lbs }])

    const isLastSet      = setIndex + 1 >= ex.sets
    const isLastExercise = exerciseIndex + 1 >= exercises.length

    if (isLastSet && isLastExercise) {
      setState('SESSION_COMPLETE')
    } else {
      setState('REST')
    }
  }, [exercises, exerciseIndex, setIndex])

  // advanceAfterRest — called after rest period ends
  const advanceAfterRest = useCallback(() => {
    const ex = exercises[exerciseIndex]
    if (!ex) { setState('SESSION_COMPLETE'); return } // defensive

    const isLastSet = setIndex + 1 >= ex.sets

    if (isLastSet) {
      setExerciseIndex(i => i + 1)
      setSetIndex(0)
    } else {
      setSetIndex(i => i + 1)
    }
    setState('SET_ACTIVE')
  }, [exercises, exerciseIndex, setIndex])

  // endEarly — called when user ends workout mid-session.
  // Fills remaining sets/exercises with 0-rep entries, then triggers SESSION_COMPLETE persist.
  const endEarly = useCallback(() => {
    const logged   = [...loggedSetsRef.current]
    const exs      = exercisesRef.current
    const exIdx    = exerciseIdxRef.current
    const sIdx     = setIdxRef.current

    // Remaining sets of the current exercise
    const curEx = exs[exIdx]
    if (curEx) {
      const remainingSets = curEx.sets - sIdx
      for (let s = 0; s < remainingSets; s++) {
        logged.push({ name: curEx.name, reps: 0, weight_lbs: curEx.weight_lbs })
      }
    }

    // All exercises not yet reached
    for (let i = exIdx + 1; i < exs.length; i++) {
      const ex = exs[i]
      for (let s = 0; s < ex.sets; s++) {
        logged.push({ name: ex.name, reps: 0, weight_lbs: ex.weight_lbs })
      }
    }

    // Update ref synchronously so SESSION_COMPLETE effect reads the full data
    loggedSetsRef.current = logged
    setLoggedSets(logged)
    setState('SESSION_COMPLETE')
  }, [])

  // Persist session and fetch agent feedback when SESSION_COMPLETE
  useEffect(() => {
    if (state !== 'SESSION_COMPLETE') return
    if (alreadyDoneToday) return  // session already saved earlier, don't re-insert

    const logged   = loggedSetsRef.current
    const label    = dayLabelRef.current

    // Group sets by exercise name
    const map = {}
    for (const { name, reps, weight_lbs } of logged) {
      if (!map[name]) map[name] = { name, sets: [] }
      map[name].sets.push({ reps, weight_lbs })
    }
    const exercisesData = Object.values(map)

    async function persistAndFeedback() {
      // Disable "Done" button immediately — covers the insert AND feedback loading.
      // Without this, the button is active during the Supabase insert, allowing the
      // user to navigate home before the session is committed to the DB.
      setFeedbackLoading(true)

      const { error } = await supabase.from('sessions').insert({
        user_id:      userId,
        date:         localDateStr(),
        exercises:    exercisesData,
        completed:    true,
        workout_name: label || null,
      })
      if (error) console.error('[useSession] session insert failed:', error)

      if (exercisesData.length > 0) {
        const summary = exercisesData
          .map(ex => `${ex.name}: ${ex.sets.map(s => `${s.reps}×${s.weight_lbs}lbs`).join(', ')}`)
          .join('\n')
        callFeedback(userId, summary)
          .then(text => setFeedback(text))
          .catch(err => { if (isRateLimitError(err)) setFeedback('Daily limit reached — come back tomorrow.') })
          .finally(() => setFeedbackLoading(false))
      } else {
        setFeedbackLoading(false)
      }
    }

    persistAndFeedback()
  }, [state, userId, alreadyDoneToday])

  return {
    state,
    exercises,
    exerciseIndex,
    setIndex,
    dayLabel,
    feedback,
    feedbackLoading,
    isLoading,
    alreadyDoneToday,
    isRestDay,
    start,
    beginSession,
    updateWeight,
    confirmWeights,
    logSet,
    advanceAfterRest,
    endEarly,
  }
}
