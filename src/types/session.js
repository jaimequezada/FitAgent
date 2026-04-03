// session.js
// Shape definitions for gym session data.

/**
 * @typedef {Object} Session
 * @property {string} id
 * @property {string} user_id
 * @property {string} date          - ISO date string
 * @property {ExerciseLog[]} exercises
 * @property {boolean} completed
 * @property {string} notes
 */

/**
 * @typedef {Object} ExerciseLog
 * @property {string} name
 * @property {SetLog[]} sets
 * @property {number} weight_used
 */

/**
 * @typedef {Object} SetLog
 * @property {number} set_number
 * @property {number} target_reps
 * @property {number} actual_reps
 * @property {boolean} failed
 */

/**
 * @typedef {'IDLE'|'CONFIRM_WEIGHT'|'SET_ACTIVE'|'REST'|'SESSION_COMPLETE'} GymState
 */
