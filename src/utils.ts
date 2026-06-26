export function formatDateBR(dateString: string): string {
  if (!dateString) return "";
  
  // Se já estiver no formato DD/MM/YYYY
  if (dateString.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      return dateString;
  }

  // Verifica se é YYYY-MM-DD ou YYYY-MM-DDTHH:mm...
  if (dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
    const year = dateString.substring(0, 4);
    const month = dateString.substring(5, 7);
    const day = dateString.substring(8, 10);
    return `${day}/${month}/${year}`;
  }
  
  // Try fallback
  try {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
       const day = String(date.getDate()).padStart(2, '0');
       const month = String(date.getMonth() + 1).padStart(2, '0');
       const year = date.getFullYear();
       return `${day}/${month}/${year}`;
    }
  } catch (e) {}

  return dateString;
}
