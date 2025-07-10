# Credit 

- [jannispaul](https://jannispaul.github.io/wisita-url-fetcher)

# Logarithmic calculation 

Let me explain the logarithmic calculation in the `#formatSize` method.

## Original Implementation:
```javascript
formatSize(bytes) {
  if (!bytes || bytes === 0) return "N/A";

  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex > 0 ? 2 : 0)} ${units[unitIndex]}`;
}
```

## Modern Implementation:
```javascript
#formatSize(bytes) {
  if (!bytes) return "N/A";

  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 2 : 0)} ${units[i]}`;
}
```

## How the Logarithmic Calculation Works:

### 1. **The Math Behind It:**
- We need to find how many times we can divide `bytes` by 1024 to get the appropriate unit
- This is equivalent to finding: `1024^x ≤ bytes < 1024^(x+1)`
- Taking logarithms: `x ≤ log₁₀₂₄(bytes) < x+1`
- Using the change of base formula: `log₁₀₂₄(bytes) = log(bytes) / log(1024)`

### 2. **Step-by-Step Example:**
Let's say we have `5,242,880 bytes` (5 MB):

```javascript
// Original approach:
// 5,242,880 ÷ 1024 = 5,120 (KB)
// 5,120 ÷ 1024 = 5 (MB)
// Looped 2 times, unitIndex = 2

// Logarithmic approach:
Math.log(5242880) / Math.log(1024) = 2.0
Math.floor(2.0) = 2
// Directly gives us index 2 (MB)
```

### 3. **Performance Benefits:**
- **Original**: O(n) - loops up to 4 times in worst case
- **Modern**: O(1) - constant time calculation

### 4. **The Final Calculation:**
```javascript
bytes / Math.pow(1024, i)
```
This divides the bytes by `1024^i` to get the final value:
- If `i = 0`: divides by 1 (stays in bytes)
- If `i = 1`: divides by 1024 (converts to KB)
- If `i = 2`: divides by 1024² (converts to MB)
- If `i = 3`: divides by 1024³ (converts to GB)

## Visual Comparison:

```javascript
// For 1,073,741,824 bytes (1 GB):

// Original method:
// 1,073,741,824 → 1,048,576 → 1,024 → 1
// (3 divisions, 3 iterations)

// Logarithmic method:
// log(1,073,741,824) / log(1024) = 3.0
// 1,073,741,824 / 1024³ = 1
// (1 calculation, no loops)
```

The logarithmic approach is more elegant and efficient, especially for very large file sizes, as it directly calculates which unit to use without iterating.