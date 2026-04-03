// memory.js
// Shape definitions for the three living memory documents.

/**
 * @typedef {Object} ProgramChange
 * @property {string} date
 * @property {string} change
 * @property {string} reason
 * @property {string} affected_day
 */

/**
 * @typedef {Object} Decision
 * @property {string} date
 * @property {string} topic
 * @property {string} decision
 * @property {boolean} user_agreed
 */

/**
 * @typedef {Object} Signal
 * @property {string} date
 * @property {string} type
 * @property {string} note
 * @property {boolean} flagged
 * @property {boolean} resolved  - true once the signal has been addressed; excluded from future Claude context
 */

/**
 * @typedef {Object} MemoryDoc
 * @property {string} user_id
 * @property {ProgramChange[]} program_changes
 * @property {Decision[]} decisions
 * @property {Signal[]} signals
 * @property {string} history_summary
 * @property {Object} current_program
 */
