/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {string} businessName
 * @property {string} businessType
 * @property {string} [businessLogo]
 * @property {string} createdAt
 */

/**
 * @typedef {Object} Client
 * @property {string} id
 * @property {string} name
 * @property {string} phone
 * @property {string} [notes]
 * @property {boolean} isActive
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} Service
 * @property {string} id
 * @property {string} name
 * @property {number} priceDefault
 * @property {number} durationMinutes
 * @property {boolean} isActive
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} Appointment
 * @property {string} id
 * @property {string} clientId
 * @property {string} serviceId
 * @property {string} [professionalId]
 * @property {string} date
 * @property {string} startTime
 * @property {string} endTime
 * @property {number} price
 * @property {"agendado"|"concluido"|"cancelado"|"nao_compareceu"} status
 * @property {string} [notes]
 * @property {Client} [client]
 * @property {Service} [service]
 */

/**
 * @typedef {Object} Expense
 * @property {string} id
 * @property {string} description
 * @property {string} category
 * @property {number} amount
 * @property {string} date
 * @property {"once"|"monthly"} recurrence
 * @property {string} [notes]
 */

/**
 * @typedef {Object} Product
 * @property {string} id
 * @property {string} name
 * @property {string} category
 * @property {number} costPrice
 * @property {number} salePrice
 * @property {number} stockQty
 * @property {number} minStock
 * @property {boolean} isActive
 * @property {string} [description]
 */

/**
 * @typedef {Object} Sale
 * @property {string} id
 * @property {string} productId
 * @property {string} productName
 * @property {number} quantity
 * @property {number} total
 * @property {string} date
 * @property {string} [clientId]
 * @property {string} [clientName]
 */

/**
 * @typedef {Object} Document
 * @property {string} id
 * @property {string} title
 * @property {string} content
 * @property {string} [signatureImage]
 * @property {string} [signedAt]
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} Budget
 * @property {string} id
 * @property {string} date
 * @property {Array<{id:string,name:string,price:number}>} services
 * @property {Array<{id:string,name:string,quantity:number,unitPrice:number,total:number}>} products
 * @property {number} total
 * @property {string} [notes]
 */

/**
 * @typedef {Object} MonthlyPlan
 * @property {string} id
 * @property {string} clientId
 * @property {string} clientName
 * @property {string} planName
 * @property {number} amount
 * @property {number} dueDay
 * @property {"active"|"canceled"} status
 * @property {string} startDate
 */

/**
 * @typedef {Object} TimelineEvent
 * @property {string} id
 * @property {string} date
 * @property {string} type
 * @property {string} title
 * @property {string} summary
 * @property {string} tab
 */

export const modelNames = Object.freeze({
  user: "User",
  client: "Client",
  appointment: "Appointment",
  service: "Service",
  expense: "Expense",
  product: "Product",
  sale: "Sale",
  document: "Document",
  budget: "Budget",
  monthlyPlan: "MonthlyPlan",
  timelineEvent: "TimelineEvent"
});
