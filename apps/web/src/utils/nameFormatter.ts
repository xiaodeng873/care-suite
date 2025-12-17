// src/utils/nameFormatter.ts

/**
 * Formats an English surname to uppercase.
 * @param surname The English surname.
 * @returns The formatted surname in uppercase.
 */
export const formatEnglishSurname = (surname: string | null | undefined): string => {
  if (!surname || typeof surname !== 'string') {
    return '';
  }
  return surname.toUpperCase();
};

/**
 * Formats an English given name (first name) by capitalizing the first letter of each word.
 * Words are separated by spaces.
 * @param givenName The English given name.
 * @returns The formatted given name.
 */
export const formatEnglishGivenName = (givenName: string | null | undefined): string => {
  if (!givenName || typeof givenName !== 'string') {
    return '';
  }
  return givenName
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Combines and formats English surname and given name.
 * Displays as "SURNAME, Given Name".
 * @param surname The English surname.
 * @param givenName The English given name.
 * @returns The combined and formatted English name string.
 */
export const getFormattedEnglishName = (surname?: string, givenName?: string): string => {
  const formattedSurname = formatEnglishSurname(surname);
  const formattedGivenName = formatEnglishGivenName(givenName);

  if (formattedSurname && formattedGivenName) {
    return `${formattedSurname}, ${formattedGivenName}`;
  } else if (formattedSurname) {
    return formattedSurname;
  } else if (formattedGivenName) {
    return formattedGivenName;
  }
  return '';
};