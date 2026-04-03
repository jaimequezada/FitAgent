// user.js
// Shape definitions for user profile data (JSDoc for IDE hints).

/**
 * @typedef {Object} UserProfile
 * @property {string} user_id
 * @property {number} age
 * @property {string} sex
 * @property {number} weight         - kg
 * @property {number} height         - cm
 * @property {number} experience_months
 * @property {'hypertrophy'|'strength'|'athletic'} goal
 * @property {string} equipment
 * @property {number} days_per_week
 * @property {number} session_length  - minutes
 * @property {string} injuries
 * @property {WorkingWeights} working_weights
 * @property {string} physique_priorities
 * @property {UserPreferences} preferences
 */

/**
 * @typedef {Object} WorkingWeights
 * @property {number} bench
 * @property {number} squat
 * @property {number} deadlift
 * @property {number} ohp
 */

/**
 * @typedef {Object} UserPreferences
 * @property {string} communication_style
 * @property {string} program_style
 * @property {string} goals_priority
 * @property {string[]} dislikes
 * @property {string} responds_well_to
 */
