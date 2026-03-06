//constants
import { HttpStatus } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';

interface Response<T> {
  status: HttpStatus;
  data: T;
}

class Metadata {
  @ApiPropertyOptional()
  pageNumber?: number;

  @ApiPropertyOptional()
  limit?: number;

  @ApiPropertyOptional()
  totalCount?: number;
}

enum LogType {
  INFO = 'info',
  ERROR = 'error',
  WARN = 'warn',
}

const CURRENT_DATE = new Date();

const EXPIRES_IN = '1h';

const METERS_PER_MILE = 1609.344;

const YARDS_PER_METER = 1.09361;

enum Gender {
  FEMALE = 'FEMALE',
  MALE = 'MALE',
  NON_BINARY = 'NON_BINARY',
  OTHER = 'OTHER',
  PREFER_NOT_TO_SAY = 'PREFER_NOT_TO_SAY',
}

enum ActionStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

const DATA_STATUS = {
  ACTIVE: 'A',
  PENDING: 'P',
  INACTIVE: 'I',
  DELETED: 'X',
};
const REC_STATUS = {
  ACTIVE: 'A',
  PENDING: 'P',
  INACTIVE: 'I',
  DELETED: 'X',
};

const REC_SEQ = {
  DEFAULT_RECORD: 0,
  FIRST_RECORD: 1,
};

const ACTIVE_CONDITION = {
  recSeq: REC_SEQ.DEFAULT_RECORD,
  recStatus: REC_STATUS.ACTIVE,
  dataStatus: DATA_STATUS.ACTIVE,
};

const ADMIN = 'b87e7c4a-33af-4c62-a8ab-96a2de431c91';

const DB_NAME = 'public';

const TABLE_NAMES = {
  USERS: 'Users',
  LIST_ITEMS: 'ListItems',
  USER_LISTS: 'UserLists',
  USER_LISTS_INTEGRATIONS: 'UserListIntegrations',
};

const RESPONSE_STATUS = {
  TOKEN: 'Token ',
  USER: 'User ',
  USERNAME: 'Username ',
  PHONE_NUMBER: 'Phone Number ',
  EMAIL: 'Email ',
  METHOD: 'Method ',
  SIGNUP: 'Sign Up ',
  SIGNIN: 'Sign In ',
  REFRESH: 'Refresh ',
  LOGOUT: 'Logout ',
  LISTITEMS: 'ListItems ',
  VISUALIZATIONS: 'Visualizations ',
  PLEASE_TRY_AGAIN: 'Please try again',
  SUCCESSFUL: 'Successful ',
  SUCCESS: {
    CREATE: 'Created successfully',
    UPDATE: 'Updated successfully',
    DELETE: 'Deleted successfully',
    FIND_ALL: 'Fetched All successfully',
    FIND_UNIQUE: 'Fetched successfully',
  },
  ERROR: {
    REQUIRED: 'Required ',
    NOT_FOUND: 'Not Found ',
    ALREADY_EXISTS: 'Already Exists ',
    INVALID: 'Invalid ',
    BAD_REQUEST: 'Bad Request ',
    INTERNAL_SERVER_ERROR: 'Internal Server Error ',
    ERROR_OCCURRED: 'Error Occurred',
    UNAUTHORIZED: 'Unauthorized',
    FORBIDDEN: 'Forbidden',
  },
};
enum MethodNames {
  create = 'create',
  update = 'update',
  delete = 'delete',
  findAll = 'findAll',
  findUnique = 'findUnique',
  updateStatus = 'updateStatus',
  verifyUser = 'verifyUser',
  refreshToken = 'refreshToken',
  logout = 'logout',
  getUserSpotifyData = 'getUserSpotifyData',
  getCallbackUrl = 'getCallbackUrl',
  disconnect = 'disconnect',
  createConnection = 'createConnection',
  handleCallback = 'handleCallback',
  sync = 'sync',
  status = 'status',
  handleDataUpload = 'handleDataUpload',
  processHealthData = 'processHealthData',
  ensureValidAccessToken = 'ensureValidAccessToken',
  fetchRecentlyPlayed = 'fetchRecentlyPlayed',
  fetchLibrarySongs = 'fetchLibrarySongs',
  fetchPlaylists = 'fetchPlaylists',
  getProviderOrThrow = 'getProviderOrThrow',
  handleCallbackWithUserData = 'handleCallbackWithUserData',
  getUserDataWithSyncedContent = 'getUserDataWithSyncedContent',
  getAllIntegrationStatuses = 'getAllIntegrationStatuses',
  handleAppleHealthUpload = 'handleAppleHealthUpload',
  getActivityReport = 'getActivityReport',
  getListsAndItemsReport = 'getListsAndItemsReport',
  getTransportReport = 'getTransportReport',
  getTravelReport = 'getTravelReport',
  getHealthReport = 'getHealthReport',
  getFoodReport = 'getFoodReport',
  getPlacesVisitedReport = 'getPlacesVisitedReport',
  getEventsReport = 'getEventsReport',
  getBooksReport = 'getBooksReport',
  getMusicReport = 'getMusicReport',
  storePlayHistorySnapshot = 'storePlayHistorySnapshot',
  getLastPlayHistorySnapshot = 'getLastPlayHistorySnapshot',
  getFriendsReport = 'getFriendsReport',
}

const STATUS = {
  PENDING: 'PENDING',
  CONNECTED: 'CONNECTED',
  DISCONNECTED: 'DISCONNECTED',
  SYNCING: 'SYNCING',
};

const DATA_TYPE = {
  STRING: 'string',
  NUMBER: 'number',
  DATE: 'date',
  BOOLEAN: 'boolean',
  JSON: 'json',
  STRING_ARRAY: 'string[]',
};

interface ActivityEntry {
  activityName: string;
  start: Date;
  hours: number;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const PROVIDER_ORDER = [
  'apple_health', // Changed from 'apple-health'
  'gmail_scraper', // Changed from 'email-scraper'
  'plaid',
  'strava',
  'spotify',
  'apple_music', // Changed from 'apple-music'
];

const LIST_ORDER = {
  Activity: 1,
  Health: 2,
  Music: 3,
  Travel: 4,
  Food: 5,
  Transport: 6,
  'Places Visited': 7,
  Events: 8,
  Friends: 9,
  Books: 10,
  Custom: 11,
};

interface SenderConfig {
  domains: string[];
  mainEmailIndicators: {
    senderNames?: string[];
    subjectKeywords?: string[];
    bodyKeywords?: string[];
  };
  promotionalIndicators?: {
    senderNames?: string[];
    subjectKeywords?: string[];
    bodyKeywords?: string[];
  };
}

const KNOWN_SENDERS: Record<string, SenderConfig> = {
  uber: {
    domains: ['uber.com', 'ubermessages.com', 'uberupdates.com'],
    mainEmailIndicators: {
      senderNames: ['noreply@uber.com', 'receipts@uber.com'],
      subjectKeywords: ['receipt', 'trip', 'ride', 'fare', 'your driver'],
      bodyKeywords: ['pickup', 'dropoff', 'fare', 'duration'],
    },
    promotionalIndicators: {
      subjectKeywords: ['offer', 'discount', 'deal', 'save'],
      bodyKeywords: ['limited time', 'exclusive', 'promo', 'coupon'],
    },
  },

  lyft: {
    domains: ['lyft.com'],
    mainEmailIndicators: {
      senderNames: ['noreply@lyft.com', 'receipts@lyft.com'],
      subjectKeywords: ['receipt', 'ride', 'fare'],
      bodyKeywords: ['driver', 'pickup', 'dropoff'],
    },
    promotionalIndicators: {
      subjectKeywords: ['credit', 'free ride', 'offer'],
      bodyKeywords: ['limited time', 'try now'],
    },
  },

  doordash: {
    domains: ['doordash.com'],
    mainEmailIndicators: {
      senderNames: ['orders@doordash.com', 'noreply@doordash.com'],
      subjectKeywords: ['order', 'delivery', 'receipt'],
      bodyKeywords: ['restaurant', 'delivery address', 'items'],
    },
    promotionalIndicators: {
      subjectKeywords: ['deal', 'promotion', 'offer'],
      bodyKeywords: ['save', 'limited time', 'exclusive'],
    },
  },

  ubereats: {
    domains: ['ubereats.com', 'eat.uber.com'],
    mainEmailIndicators: {
      senderNames: ['noreply@ubereats.com', 'receipts@ubereats.com'],
      subjectKeywords: ['order', 'delivery', 'receipt'],
      bodyKeywords: ['restaurant', 'items'],
    },
    promotionalIndicators: {
      subjectKeywords: ['offer', 'discount', 'deal'],
      bodyKeywords: ['exclusive', 'limited time'],
    },
  },

  zomato: {
    domains: ['zomato.com', 'zomatomail.com'],
    mainEmailIndicators: {
      senderNames: ['noreply@zomato.com'],
      subjectKeywords: ['order', 'delivery', 'payment', 'receipt'],
      bodyKeywords: ['Bill Summary', 'Total Amount', 'delivery address'],
    },
    promotionalIndicators: {
      subjectKeywords: ['offer', 'discount', 'deal'],
      bodyKeywords: ['save now', 'exclusive offer'],
    },
  },

  swiggy: {
    domains: ['swiggy.com', 'swiggy.in'],
    mainEmailIndicators: {
      senderNames: ['noreply@swiggy.in', 'swiggy.in'],
      subjectKeywords: ['order', 'delivered', 'receipt', 'confirmed'],
      bodyKeywords: [
        'order number',
        'items',
        'total amount',
        'delivery address',
      ],
    },
    promotionalIndicators: {
      subjectKeywords: ['offer', 'discount', 'deal', 'save'],
      bodyKeywords: ['limited time', 'exclusive', 'promo', 'coupon'],
    },
  },

  booking: {
    domains: ['booking.com'],
    mainEmailIndicators: {
      senderNames: ['noreply@booking.com'],
      subjectKeywords: ['booking', 'reservation', 'confirmation'],
      bodyKeywords: ['check-in', 'confirmation number', 'hotel address'],
    },
    promotionalIndicators: {
      subjectKeywords: ['deal', 'sale', 'inspiration'],
      bodyKeywords: ['book now', 'limited time'],
    },
  },

  airbnb: {
    domains: ['airbnb.com'],
    mainEmailIndicators: {
      senderNames: ['noreply@airbnb.com'],
      subjectKeywords: ['booking', 'reservation'],
      bodyKeywords: ['check-in', 'check-out'],
    },
    promotionalIndicators: {
      subjectKeywords: ['inspiration', 'ideas', 'explore'],
      bodyKeywords: ['check out these stays', 'exclusive'],
    },
  },

  delta: {
    domains: ['delta.com'],
    mainEmailIndicators: {
      senderNames: ['noreply@delta.com'],
      subjectKeywords: ['itinerary', 'receipt', 'flight'],
      bodyKeywords: ['gate', 'departure', 'arrival', 'confirmation'],
    },
    promotionalIndicators: {
      subjectKeywords: ['sale', 'fare offer'],
      bodyKeywords: ['exclusive fare', 'book now'],
    },
  },

  amazon: {
    domains: [
      'amazon.com',
      'amazon.in',
      'amazon.co.uk',
      'amazon.ca',
      'amazon.de',
      'amazon.sg',
    ],
    mainEmailIndicators: {
      senderNames: ['order-update@amazon.com', 'shipment-tracking@amazon.com'],
      subjectKeywords: ['order', 'your package', 'delivery'],
      bodyKeywords: ['order number', 'items', 'total amount', 'tracking'],
    },
    promotionalIndicators: {
      subjectKeywords: ['deal', 'offer', 'sale'],
      bodyKeywords: ['exclusive', 'limited time', 'recommendations for you'],
    },
  },
};

const PROMOTIONAL_KEYWORDS = [
  'sale',
  // 'discount',
  // 'offer',
  // 'coupon',
  'deal',
  'limited time',
  'shop now',
  'exclusive',
  'promotion',
  'clearance',
  'flash sale',
  'today only',
  'save up to',
  'special offer',
  'hurry',
  'new sign-in',
  'security alert',
  'unsubscribe',
  'account activity',
  'finish setting up',
  'finish set-up',
  'verify your',
  'Refund amount',
  'refund amount',
];

const PROMOTIONAL_SENDER_PATTERNS = [
  '@promo',
  '@offers',
  '@newsletter',
  '@marketing',
  '@promotions',
  '@sales',
  '@deals',
  '@advertising',
  'promo@',
  'offers@',
  'newsletter@',
  'marketing@',
];

interface EmailAttachment {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId?: string | null;
}

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    partId: string;
    mimeType: string;
    filename: string;
    headers: Array<{
      name: string;
      value: string;
    }>;
    body: {
      attachmentId?: string;
      size: number;
      data?: string;
    };
    parts?: Array<{
      partId: string;
      mimeType: string;
      filename: string;
      headers: Array<{
        name: string;
        value: string;
      }>;
      body: {
        attachmentId?: string;
        size: number;
        data?: string;
      };
    }>;
  };
  sizeEstimate: number;
  historyId: string;
  internalDate: string;
}

interface EmailData {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: Date;
  body: string;
  text?: string;
  originalBody: string;
  html?: string;
  snippet: string;
  labels: string[];
  attachments: Array<{
    filename: string;
    mimeType: string;
    size: number;
  }>;
}

const COOLDOWN_MINUTES = 5;
const COOLDOWN_MS = COOLDOWN_MINUTES * 60 * 1000;

const SYNC_TIMEOUT_MINUTES = 30;
const SYNC_TIMEOUT_MS = SYNC_TIMEOUT_MINUTES * 60 * 1000;

const UNITS = ['steps', 'miles', 'bpm', 'vo2max', 'duration'];

enum ListNames {
  HEALTH = 'Health',
  ACTIVITY = 'Activity',
  MUSIC = 'Music',
  TRAVEL = 'Travel',
  FOOD = 'Food',
  TRANSPORT = 'Transport',
  PLACES_VISITED = 'Places Visited',
  EVENTS = 'Events',
  FRIENDS = 'Friends',
  BOOKS = 'Books',
}

const FOOD_KEYWORDS = [
  'breakfast',
  'brunch',
  'morning',
  'bagel',
  'pancake',
  'waffle',
  'omelet',
  'omelette',
  'bacon',
  'egg',
  'toast',
  'biscuit',
  'crepe',
  'croissant',
  'dennys',
  "denny's",
  'ihop',
  'waffle house',
  'first watch',
  'snooze an am',
  'snooze',
  'black bear diner',
  'lunch',
  'deli',
  'sandwich',
  'subs',
  'sub shop',
  'hoagie',
  'bento',
  'salad',
  'subway',
  'jimmy johns',
  "jimmy john's",
  'jersey mike',
  'firehouse subs',
  'which wich',
  'panera',
  'chipotle',
  'burger king',
  'mcdonald',
  'kfc',
  'wendys',
  "wendy's",
  'five guys',
  'in-n-out',
  'shake shack',
  'dinner',
  'restaurant',
  'bistro',
  'tavern',
  'grill',
  'bar & grill',
  'steakhouse',
  'steak house',
  'chophouse',
  'diner',
  'italian',
  'pasta',
  'ristorante',
  'trattoria',
  'korean bbq',
  'bbq',
  'seafood',
  'sushi',
  'hibachi',
  'teppanyaki',
  'thai',
  'indian',
  'mediterranean',
  'olive garden',
  'cheesecake factory',
  'texas roadhouse',
  'chilis',
  "chili's",
  'applebees',
  "applebee's",
  'red lobster',
];

const PROMPTS = {
  classification_engine: {
    description:
      'You are an intelligent data classification engine. You receive structured or unstructured text (messages, logs, descriptions). Your task is to classify each entry into the defined categories and subcategories. You must return JSON ONLY. If nothing matches any category → skip: true.',

    output_rules: [
      'Only return JSON. No explanation or surrounding text.',
      'If category or subcategory cannot be determined → skip: true.',
      'Promotional, marketing, newsletters, social notifications → always skip.',
      'Use category-specific extracted_entities (DO NOT use common fields).',
      "Normalize all natural-language dates (e.g., '08 November', 'Nov 8th') to ISO format (YYYY-MM-DD). Be extremely careful not to swap Month and Day. If the text says 'Dec 11', it is 2025-12-11, NOT 2025-11-12.",
      "All date fields MUST be returned ONLY in ISO format: YYYY-MM-DD. If the input does not contain a date/time in the email body → use the email sent date/time instead. If no date/time is available → return an empty string('') for that field. Do NOT skip the entry due to missing dates.",
      "All time fields MUST be returned ONLY in 12-hour format with AM/PM (HH:MM AM/PM). Examples: '06:45 PM', '09:10 AM'. If the input does not contain a time in the email body → use the email sent time instead. If no date/time is available → return an empty string('') for that field. Do NOT infer or guess missing time.",
      'IMPORTANT: Analyze ALL attachment content (if provided) thoroughly. Extract relevant information from attachments (invoices, receipts, confirmations, etc.) and include the data in the extracted_entities. Attachment content should be treated with the same priority as email body content.',
      "DELIVERY NOTIFICATIONS: Emails with subjects like 'Ordered: ', 'Your order was delivered', 'Order delivered', or similar are valid transaction records. If such an email is the only one provided for an order, extract all available information (Order ID, Restaurant/Store name, items if listed, total if listed). Do NOT skip simply because it is a 'delivered' notification instead of a 'confirmation' receipt.",
      'For related email sequences (e.g., order confirmation → shipment → out for delivery → delivered for the same order), identify emails about the SAME transaction or order. Extract data from the FIRST email in the sequence (typically the order confirmation or initial transaction). Skip all subsequent related emails (shipment, delivery, etc.) for the same order/transaction.',
      'DEDUPLICATION RULE: If multiple emails reference the same order ID, transaction ID, or delivery tracking number, only extract from the earliest/first email and mark others with skip: true. If you only see one such email, process it normally regardless of whether it is a confirmation or a delivery notification.',
    ],

    categories: [
      {
        name: 'Travel',
        subcategories: [
          {
            name: 'Domestic',
            match_rules: [
              'Mentions: trip, travel, itinerary, hotel, booking, stay, city, state.',
              'Travel occurs within the same country.',
            ],
            extracted_entities: {
              name_of_trip: '',
              state: '',
              city: '',
              country: '',
              start_date: 'Format: YYYY-MM-DD',
              end_date: 'Format: YYYY-MM-DD',
              start_time: '',
              end_time: '',
              address: '',
              duration: '',
              description: '',
            },
          },
          {
            name: 'International',
            match_rules: [
              'Travel involves crossing country borders.',
              'Mentions: country, international flight, overseas trip.',
            ],
            extracted_entities: {
              name_of_trip: '',
              country: '',
              city: '',
              state: '',
              start_date: 'Format: YYYY-MM-DD',
              end_date: 'Format: YYYY-MM-DD',
              start_time: '',
              end_time: '',
              address: '',
              duration: '',
              description: '',
            },
          },
        ],
      },

      {
        name: 'Food',
        subcategories: [
          {
            name: 'Coffee Shops',
            match_rules: [
              'Mentions cafes, coffee places, beverages, coffee orders.',
            ],
            extracted_entities: {
              name_of_place: '',
              address: '',
              ordered_date: 'Format: YYYY-MM-DD',
              ordered_time: '',
              item: '',
              price: '',
              order_id: '',
              description: '',
            },
          },
          {
            name: 'Breakfast',
            match_rules: ['Morning meal at restaurant or cafe.'],
            extracted_entities: {
              name_of_place: '',
              address: '',
              ordered_date: 'Format: YYYY-MM-DD',
              ordered_time: '',
              cuisine_type: '',
              item: '',
              price: '',
              order_id: '',
              description: '',
            },
          },
          {
            name: 'Lunch',
            match_rules: ['Afternoon meal; restaurant visit or food order.'],
            extracted_entities: {
              name_of_place: '',
              address: '',
              ordered_date: 'Format: YYYY-MM-DD',
              ordered_time: '',
              cuisine_type: '',
              item: '',
              price: '',
              order_id: '',
              description: '',
            },
          },
          {
            name: 'Dinner',
            match_rules: ['Evening meal; restaurant visit or food order.'],
            extracted_entities: {
              name_of_place: '',
              address: '',
              ordered_date: 'Format: YYYY-MM-DD',
              ordered_time: '',
              cuisine_type: '',
              item: '',
              price: '',
              order_id: '',
              description: '',
            },
          },
          {
            name: 'Sweet Treat',
            match_rules: ['Desserts, snacks, bakeries, ice-creams, sweets.'],
            extracted_entities: {
              name_of_place: '',
              address: '',
              ordered_date: 'Format: YYYY-MM-DD',
              ordered_time: '',
              item: '',
              price: '',
              order_id: '',
              description: '',
            },
          },
          {
            name: 'Drinks',
            match_rules: ['Bars, cocktails, alcohol, beverage outings.'],
            extracted_entities: {
              name_of_place: '',
              address: '',
              ordered_date: 'Format: YYYY-MM-DD',
              ordered_time: '',
              item: '',
              price: '',
              order_id: '',
              description: '',
            },
          },
        ],
      },

      {
        name: 'Transport',
        subcategories: [
          {
            name: 'Public Transport',
            match_rules: ['Bus, tram, subway, metro, ferry, public transit.'],
            extracted_entities: {
              company_name: '',
              start_location: '',
              end_location: '',
              start_date: 'Format: YYYY-MM-DD',
              end_date: 'Format: YYYY-MM-DD',
              start_time: '',
              end_time: '',
              duration: '',
              price: '',
              description: '',
            },
          },
          {
            name: 'RideShare',
            match_rules: ['Uber, Ola, Lyft, Bolt, taxi rides.'],
            extracted_entities: {
              company_name: '',
              start_location: '',
              end_location: '',
              start_date: 'Format: YYYY-MM-DD',
              end_date: 'Format: YYYY-MM-DD',
              start_time: '',
              end_time: '',
              duration: '',
              price: '',
              description: '',
            },
          },
          {
            name: 'Airplane',
            match_rules: ['Flight, airline, air travel.'],
            extracted_entities: {
              company_name: '',
              start_location: '',
              end_location: '',
              start_date: 'Format: YYYY-MM-DD',
              end_date: 'Format: YYYY-MM-DD',
              start_time: '',
              end_time: '',
              duration: '',
              price: '',
              description: '',
              state: '',
              country: '',
              city: '',
              domestic_or_international: '',
              name_of_trip: '',
            },
          },
          {
            name: 'Car',
            match_rules: ['Rental car, personal car travel, road trip.'],
            extracted_entities: {
              company_name: '',
              start_location: '',
              end_location: '',
              start_date: 'Format: YYYY-MM-DD',
              end_date: 'Format: YYYY-MM-DD',
              start_time: '',
              end_time: '',
              duration: '',
              price: '',
              description: '',
            },
          },
          {
            name: 'Train',
            match_rules: [
              'Railway travel, intercity trains, metro rail (non-public transit).',
            ],
            extracted_entities: {
              company_name: '',
              start_location: '',
              end_location: '',
              start_date: 'Format: YYYY-MM-DD',
              end_date: 'Format: YYYY-MM-DD',
              start_time: '',
              end_time: '',
              duration: '',
              price: '',
              description: '',
            },
          },
        ],
      },

      {
        name: 'Places Visited',
        subcategories: [
          {
            name: 'Grocery Stores',
            match_rules: ['Supermarkets, grocery purchases, store visits.'],
            extracted_entities: {
              name_of_grocery_store: '',
              address: '',
              ordered_date: 'Format: YYYY-MM-DD',
              ordered_time: '',
              items: '',
              order_id: '',
              description: '',
            },
          },
          {
            name: 'Parks',
            match_rules: ['Park visits, nature, outdoor recreation.'],
            extracted_entities: {
              name_of_park: '',
              address: '',
              date: 'Format: YYYY-MM-DD',
              time: '',
              description: '',
            },
          },
          {
            name: 'Museums',
            match_rules: ['Museum, exhibits, cultural visits.'],
            extracted_entities: {
              name_of_place: '',
              address: '',
              date: 'Format: YYYY-MM-DD',
              time: '',
              description: '',
            },
          },
          {
            name: 'Friends Homes',
            match_rules: ["Visit to someone's home or apartment."],
            extracted_entities: {
              name_of_friend_place: '',
              address: '',
              date: 'Format: YYYY-MM-DD',
              time: '',
              description: '',
            },
          },
          {
            name: 'Online Stores',
            match_rules: [
              'Online shopping, e-commerce orders, delivery confirmations.',
              'Mentions websites: Amazon, eBay, Flipkart, Walmart.com, Target.com.',
              'Store is NOT physically visited.',
            ],
            extracted_entities: {
              name_of_online_store: '',
              address: '',
              date: 'Format: YYYY-MM-DD',
              time: '',
              order_id: '',
              description: '',
            },
          },
          {
            name: 'Retail Stores',
            match_rules: [
              'Physical shopping visits to stores, malls, showrooms.',
              'Mentions: in-store purchase, visited store, showroom, outlet, mall.',
            ],
            extracted_entities: {
              name_of_retail_store: '',
              address: '',
              date: 'Format: YYYY-MM-DD',
              time: '',
              order_id: '',
              description: '',
            },
          },
        ],
      },
    ],

    always_skip: [
      'Promotional emails',
      'Marketing emails',
      'Newsletters',
      'Social notifications',
      'Anything unrelated to Travel, Food, Transport, Places Visited',
      'Entries with missing category/subcategory context',
    ],
  },
};

const PROVIDER_NAMINGS = {
  apple_health: 'Apple Health',
  gmail_scraper: 'Gmail',
  apple_music: 'Apple Music',
  plaid: 'Plaid',
  strava: 'Strava',
  spotify: 'Spotify',
};

export {
  CURRENT_DATE,
  EXPIRES_IN,
  DATA_STATUS,
  REC_STATUS,
  REC_SEQ,
  ACTIVE_CONDITION,
  ADMIN,
  RESPONSE_STATUS,
  DB_NAME,
  TABLE_NAMES,
  MethodNames,
  LogType,
  Response,
  Metadata,
  Gender,
  ActionStatus,
  ActivityEntry,
  MONTH_NAMES,
  STATUS,
  DATA_TYPE,
  PROVIDER_ORDER,
  LIST_ORDER,
  SenderConfig,
  KNOWN_SENDERS,
  PROMOTIONAL_KEYWORDS,
  PROMOTIONAL_SENDER_PATTERNS,
  EmailAttachment,
  GmailMessage,
  EmailData,
  COOLDOWN_MINUTES,
  COOLDOWN_MS,
  SYNC_TIMEOUT_MINUTES,
  SYNC_TIMEOUT_MS,
  UNITS,
  ListNames,
  FOOD_KEYWORDS,
  PROMPTS,
  PROVIDER_NAMINGS,
  METERS_PER_MILE,
  YARDS_PER_METER,
};
