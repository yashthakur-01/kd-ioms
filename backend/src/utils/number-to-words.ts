/**
 * Converts monetary amounts to words in Indian Currency Format (Rupees and Paise)
 */

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'
];

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
];

function convertBelowThousand(n: number): string {
  let str = '';
  if (n >= 100) {
    str += ONES[Math.floor(n / 100)] + ' Hundred ';
    n %= 100;
  }
  if (n >= 20) {
    const tens = TENS[Math.floor(n / 10)];
    const remainder = n % 10;
    if (remainder > 0) {
      str += tens + '-' + ONES[remainder] + ' ';
    } else {
      str += tens + ' ';
    }
  } else if (n > 0) {
    str += ONES[n] + ' ';
  }
  return str.trim();
}

/**
 * Converts a number or numeric string to Indian currency words.
 * Example: 2352 -> "Two Thousand Three Hundred Fifty-Two Rupees Only"
 */
export function numberToWords(amount: number | string): string {
  const num = typeof amount === 'number' ? amount : parseFloat(amount);
  if (isNaN(num) || num < 0) return 'Zero Rupees Only';
  if (num === 0) return 'Zero Rupees Only';

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);

  let result = '';

  const crore = Math.floor(rupees / 10000000);
  let rem = rupees % 10000000;

  const lakh = Math.floor(rem / 100000);
  rem %= 100000;

  const thousand = Math.floor(rem / 1000);
  rem %= 1000;

  const hundredAndBelow = rem;

  if (crore > 0) {
    result += convertBelowThousand(crore) + ' Crore ';
  }
  if (lakh > 0) {
    result += convertBelowThousand(lakh) + ' Lakh ';
  }
  if (thousand > 0) {
    result += convertBelowThousand(thousand) + ' Thousand ';
  }
  if (hundredAndBelow > 0) {
    result += convertBelowThousand(hundredAndBelow) + ' ';
  }

  result = result.trim();
  if (result.length > 0) {
    result += ' Rupees';
  } else {
    result = 'Zero Rupees';
  }

  if (paise > 0) {
    result += ' and ' + convertBelowThousand(paise) + ' Paise';
  }

  return result + ' Only';
}
