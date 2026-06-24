/* src/shared/lib/chartUtils.js - Utility functions for charts and visualizations */

/**
 * Calculate rolling average for a data array
 * @param {Array} data - Array of {count, ...} objects
 * @param {number} window - Rolling window size (default 7)
 * @returns {Array} Data with added 'avg' property
 */
export function calculateRollingAverage(data, window = 7) {
  if (!Array.isArray(data) || data.length === 0) return []

  return data.map((_, i, arr) => {
    const slice = arr.slice(Math.max(0, i - window + 1), i + 1)
    const sum = slice.reduce((acc, item) => acc + (item.count || 0), 0)
    const avg = sum / slice.length
    return { ...arr[i], avg: parseFloat(avg.toFixed(1)) }
  })
}

/**
 * Format date for chart display
 * @param {string} dateStr - ISO date or "YYYY-MM" string
 * @param {boolean} isMonth - Whether to format as month
 * @returns {string} Formatted date
 */
export function formatChartDate(dateStr, isMonth = false) {
  if (!dateStr) return ''

  if (isMonth) {
    // "2025-03" → "Mar '25"
    const [year, month] = dateStr.split('-')
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ]
    const shortYear = year.slice(-2)
    return `${months[parseInt(month) - 1]} '${shortYear}`
  }

  // "2025-03-15" → "Mar 15"
  const date = new Date(dateStr)
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  const day = date.getDate()
  const month = months[date.getMonth()]
  return `${month} ${day}`
}

/**
 * Format appointment date and time
 * @param {string} isoStr - ISO datetime string
 * @returns {string} Formatted "Mar 15 · 2:30 PM"
 */
export function formatAppointmentDateTime(isoStr) {
  if (!isoStr) return ''

  const date = new Date(isoStr)
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]

  const day = date.getDate()
  const month = months[date.getMonth()]
  const hours = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12

  return `${month} ${day} · ${displayHours}:${minutes} ${ampm}`
}

/**
 * Compute percentage for legend items
 * @param {number} value - Item count
 * @param {number} total - Total count
 * @returns {string} Percentage as "XX%"
 */
export function computePercentage(value, total) {
  if (total === 0) return '0%'
  const percent = Math.round((value / total) * 100)
  return `${percent}%`
}

