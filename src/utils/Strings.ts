export namespace Strings {
  export function isEmpty(str: string): boolean {
    return !str;
  }
  export function isNotEmpty(str: string): boolean {
    return !Strings.isEmpty(str);
  }
  export function isBlank(str: string): boolean {
    return Strings.isEmpty(str) || str.trim().length === 0;
  }
  export function isNotBlank(str: string): boolean {
    return !Strings.isBlank(str);
  }
}
