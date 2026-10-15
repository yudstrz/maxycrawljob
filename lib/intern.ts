export const isIntern = (text: string) =>
  /\b(intern|interns|internship|magang|trainee|apprentice|praktik\w*|werkstudent\w*|working student)\b/i.test(text);
