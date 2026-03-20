/**
 * 座位分配共用工具函式
 *
 * 提供連號搜尋與散座分配邏輯，供 LotteryService 與 SeatAllocationService 共用。
 */

export interface SeatLike {
  id: string;
  row: string;
  seatNumber: number;
}

/**
 * 在已排序（row ASC, seatNumber ASC）的座位清單中，
 * 尋找第一組同排連續 `size` 個座位。
 *
 * @returns 連續座位陣列，或 null（找不到連號）
 */
export function findConsecutiveSeats<T extends SeatLike>(
  seats: T[],
  size: number,
): T[] | null {
  if (seats.length === 0 || size <= 0) return null;
  if (size === 1) return [seats[0]];

  let run: T[] = [];

  for (const seat of seats) {
    if (
      run.length === 0 ||
      seat.row !== run[run.length - 1].row ||
      seat.seatNumber !== run[run.length - 1].seatNumber + 1
    ) {
      run = [seat];
    } else {
      run.push(seat);
    }

    if (run.length === size) {
      return run;
    }
  }

  return null;
}

/**
 * 當找不到連號時，從可用座位中取出前 `size` 個散座。
 * 優先同區同排，但不保證連號。
 *
 * @returns 散座陣列，或 null（剩餘座位不足）
 */
export function pickScatteredSeats<T extends SeatLike>(
  seats: T[],
  size: number,
): T[] | null {
  if (seats.length < size) return null;
  return seats.slice(0, size);
}
