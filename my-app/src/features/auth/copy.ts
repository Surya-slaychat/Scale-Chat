/**
 * All user-facing strings for the auth/onboarding flow.
 * Centralised so a future i18n layer can wrap them without touching screens.
 */
export const AuthCopy = {
  brand: 'ScaleChat',

  welcome: {
    headline: 'Welcome to',
    subheading: 'Let’s Setup your account',
    encryptionBadge: 'End to End Encrypted',
    cta: 'Get Started',
  },

  terms: {
    line1Lead: `By signing up, you agree to ScaleChat’s`,
    and: 'and',
    line2: (brand: string) =>
      `We use your information to create your account, deliver our services, and help keep ${brand} safe and secure. In settings, you can access, manage, and delete your account information.`,
    privacyLabel: 'Privacy Policy',
    termsLabel: 'Terms of Service',
    learnMore: 'Learn more',
    languageLabel: 'English',
    cta: 'Agree & Continue',
  },

  phone: {
    title: 'Enter your\nPhone Number',
    subtitle: (brand: string) => `${brand} will need to verify your phone number.`,
    countryLabel: 'India',
    inputPlaceholder: 'Enter Your Number',
    cta: 'Next',
    invalidNumber: 'Please enter a valid 10-digit Indian mobile number.',
    confirmTitle: 'You entered the phone number',
    confirmQuestion: 'Is this OK, or would you like to edit the number?',
    confirmEdit: 'Edit',
    confirmGetCode: 'Get Code',
    invalidModal: {
      title: 'Oh no!',
      heading: 'Invalid Phone number',
      body: 'Check your phone number or change the phone number',
      cta: 'Try Again',
    },
  },

  otp: {
    title: 'Verify\nPhone Number',
    didNotReceive: 'Didn’t Received yet?',
    resend: 'Resend Code',
    resending: 'Sending…',
    resendInSeconds: (s: number) => `Resend in ${s}s`,
    cta: 'Done',
    callCta: 'Get Code on call',
    callComingSoon: 'Get code on call is coming soon.',
    error: {
      title: 'Oh no!',
      heading: 'Invalid OTP',
      body: 'Wrong OTP. Check your message again',
      cta: 'Try Again',
    },
  },

  profile: {
    title: 'Setup\nYour Profile',
    addPhotoLabel: 'Add Profile Picture',
    fullName: 'Full Name',
    mobile: 'Mobile Number',
    bio: 'Bio',
    cta: 'Done',
    nameRequired: 'Please enter your name.',
  },

  complete: {
    greeting: (name: string) => `Hi, ${name || 'there'}`,
    title: 'Congratulation!',
    body: 'You have successfully created your account.',
    cta: 'Done',
  },
} as const;
