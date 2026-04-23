/** Cap width for criterion columns — shared by `ResultsTable` headers and `LeadRow` cells. */
export function dynamicColMaxClass(key: string): string {
  switch (key) {
    case 'location':
      return 'max-w-[8.5rem]'
    case 'company':
      return 'max-w-[7.5rem]'
    case 'title':
      return 'max-w-[8rem]'
    default:
      return 'max-w-[6rem]'
  }
}
