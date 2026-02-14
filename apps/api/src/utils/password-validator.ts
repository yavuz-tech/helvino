export type PasswordPolicyCode =
  | "PASSWORD_TOO_SHORT"
  | "PASSWORD_NEEDS_UPPERCASE"
  | "PASSWORD_NEEDS_LOWERCASE"
  | "PASSWORD_NEEDS_NUMBER"
  | "PASSWORD_NEEDS_SPECIAL"
  | "PASSWORD_TOO_COMMON";

export interface PasswordPolicyResult {
  valid: boolean;
  code?: PasswordPolicyCode;
  message?: string;
}

const MIN_LENGTH = 8;
const HAS_UPPERCASE = /[A-Z]/;
const HAS_LOWERCASE = /[a-z]/;
const HAS_NUMBER = /\d/;
const HAS_SPECIAL = /[!@#$%^&*]/;

/**
 * Top 200 most common passwords from multiple breach databases.
 * Passwords are stored lowercase for case-insensitive comparison.
 * Sources: Have I Been Pwned, SecLists, NordPass annual reports.
 */
const COMMON_PASSWORDS = new Set([
  // Top 50
  "password", "123456", "12345678", "qwerty", "abc123",
  "monkey", "1234567", "letmein", "trustno1", "dragon",
  "baseball", "iloveyou", "master", "sunshine", "ashley",
  "michael", "shadow", "123123", "654321", "superman",
  "qazwsx", "football", "password1", "password123", "000000",
  "1234567890", "welcome", "charlie", "donald", "admin",
  "admin123", "login", "princess", "starwars", "solo",
  "qwerty123", "hello", "dragon123", "freedom", "whatever",
  "111111", "121212", "flower", "hottie", "loveme",
  "zaq1zaq1", "passwd", "mustang", "access", "master123",
  // 51-100
  "shadow123", "jesus", "michael1", "ninja", "batman",
  "pass123", "abcdef", "abcd1234", "trustme", "hello123",
  "welcome1", "test123", "love123", "god123", "soccer",
  "hockey", "hunter", "ranger", "buster", "thomas",
  "robert", "soccer1", "george", "killer", "andrea",
  "jessica", "pepper", "daniel", "andrew", "joshua",
  "summer", "winter", "spring", "nicole", "chelsea",
  "biteme", "corvette", "matrix", "internet", "samantha",
  "tigger", "harley", "cowboys", "steelers", "dolphins",
  "lakers", "yankees", "jordan", "hammer", "compaq",
  // 101-150
  "1q2w3e4r", "q1w2e3r4", "zxcvbnm", "asdfghjkl", "1qaz2wsx",
  "qwertyuiop", "1q2w3e", "1234qwer", "123qwe", "zxcvbn",
  "pass1234", "changeme", "letmein1", "default", "administrator",
  "passw0rd", "p@ssw0rd", "p@ssword", "pa$$word", "pa55word",
  "qwer1234", "test1234", "asdf1234", "temp1234", "user1234",
  "guest123", "root123", "admin1234", "login123", "abc1234",
  "pass12345", "12341234", "11223344", "aabbccdd", "aaa111",
  "qqq111", "zzz111", "123abc", "a123456", "x123456",
  "1password", "mypassword", "secretpassword", "supersecret", "topsecret",
  "computer", "jennifer", "amanda", "michelle", "heather",
  // 151-200
  "qwerty1", "1234abcd", "password2", "password12", "test",
  "guest", "apple", "banana", "orange", "purple",
  "diamond", "platinum", "thunder", "maverick", "phoenix",
  "falcon", "eagle", "panther", "viper", "cobra",
  "matrix1", "hacker", "system", "server", "network",
  "oracle", "database", "backup", "security", "firewall",
  "cisco", "linux", "windows", "ubuntu", "chrome",
  "firefox", "safari", "google", "facebook", "twitter",
  "youtube", "amazon", "apple123", "samsung", "microsoft",
  "nothing", "success", "forever", "lucky", "magic",
]);

export function validatePasswordPolicy(password: string): PasswordPolicyResult {
  const normalized = (password || "").trim().toLowerCase();

  if (!password || password.length < MIN_LENGTH) {
    return {
      valid: false,
      code: "PASSWORD_TOO_SHORT",
      message: `Password must be at least ${MIN_LENGTH} characters`,
    };
  }

  if (COMMON_PASSWORDS.has(normalized)) {
    return {
      valid: false,
      code: "PASSWORD_TOO_COMMON",
      message: "Password is too common. Please choose a stronger password",
    };
  }

  if (!HAS_UPPERCASE.test(password)) {
    return {
      valid: false,
      code: "PASSWORD_NEEDS_UPPERCASE",
      message: "Password must include at least one uppercase letter",
    };
  }

  if (!HAS_LOWERCASE.test(password)) {
    return {
      valid: false,
      code: "PASSWORD_NEEDS_LOWERCASE",
      message: "Password must include at least one lowercase letter",
    };
  }

  if (!HAS_NUMBER.test(password)) {
    return {
      valid: false,
      code: "PASSWORD_NEEDS_NUMBER",
      message: "Password must include at least one number",
    };
  }

  if (!HAS_SPECIAL.test(password)) {
    return {
      valid: false,
      code: "PASSWORD_NEEDS_SPECIAL",
      message: "Password must include at least one special character (!@#$%^&*)",
    };
  }

  return { valid: true };
}
