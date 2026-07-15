export type Category =
  | 'tools'
  | 'photography'
  | 'camping'
  | 'sports'
  | 'electronics'
  | 'home'

export interface User {
  id: string
  name: string
  email: string
  created_at: string
}

export interface Item {
  id: string
  name: string
  description: string
  category: Category
  price_per_day: number
  photo_url: string
  is_active: boolean
  owner_id: string
  owner_name: string
  created_at: string
}

export interface UnavailableRange {
  start_date: string
  end_date: string
}

export interface ItemDetail extends Item {
  unavailable_dates: UnavailableRange[]
}

export type ReservationStatus =
  | 'requested'
  | 'approved'
  | 'delivered'
  | 'returned'
  | 'closed'
  | 'rejected'
  | 'cancelled'

export type DepositStatus = 'none' | 'held' | 'released' | 'frozen'

export interface Reservation {
  id: string
  item_id: string
  item_name: string
  item_photo_url: string
  renter_id: string
  renter_name: string
  start_date: string
  end_date: string
  status: ReservationStatus
  deposit_amount: number
  deposit_status: DepositStatus
  created_at: string
  updated_at: string
}

export type TransactionType = 'hold' | 'release' | 'freeze'

export interface Transaction {
  id: string
  reservation_id: string
  type: TransactionType
  amount: number
  created_at: string
}

export interface EarningsRental {
  start_date: string
  end_date: string
  amount: number
}

export interface EarningsByItem {
  item_id: string
  item_name: string
  total: number
  rentals: EarningsRental[]
}

export interface Earnings {
  total_earnings: number
  by_item: EarningsByItem[]
}
