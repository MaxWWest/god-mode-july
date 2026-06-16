export function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const storedValue = window.localStorage.getItem(key)
    return storedValue ? (JSON.parse(storedValue) as T) : fallback
  } catch (error) {
    console.error(`Could not read ${key} from localStorage.`, error)
    return fallback
  }
}

export function saveToStorage<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.error(`Could not save ${key} to localStorage.`, error)
  }
}
