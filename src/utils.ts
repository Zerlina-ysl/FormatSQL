import { format } from "sql-formatter";

/**
 * SQL参数类型
 */
type SqlParam = string | number | boolean;

/**
 * HTML解码函数
 */
function decodeHtmlEntities(text: string): string {
  const htmlEntities: { [key: string]: string } = {
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' '
  };

  return text.replace(/&[a-zA-Z0-9#]+;/g, (entity) => {
    return htmlEntities[entity] || entity;
  });
}

/**
 * 解析Mybatis日志，提取SQL语句和参数
 */
export function parseMybatisLog(log: string): { sql: string | null; params: SqlParam[] } {
  // 对日志进行HTML解码
  const decodedLog = decodeHtmlEntities(log);

  // 提取SQL语句 - 匹配SELECT/INSERT/UPDATE/DELETE开头的语句
  // 改进正则表达式以处理更复杂的日志格式
  const sqlRegex = /Preparing:\s*(SELECT|INSERT|UPDATE|DELETE)[\s\S]*?(?=\n.*?Parameters:|==>.*?Parameters:|<==|\d{4}-\d{2}-\d{2}|$)/i;
  let sqlMatch = decodedLog.match(sqlRegex);

  // 如果没有匹配到 Preparing: 格式，尝试直接匹配SQL语句
  if (!sqlMatch) {
    const fallbackRegex = /(SELECT|INSERT|UPDATE|DELETE)[\s\S]*?(?=Parameters:|==>|<==|\d{4}-\d{2}-\d{2}|\[DEBUG\]|\[INFO\]|$)/i;
    sqlMatch = decodedLog.match(fallbackRegex);
  }

  let sql = sqlMatch ? sqlMatch[0].trim() : null;

  // 清理SQL语句，移除 "Preparing:" 前缀
  if (sql && sql.includes('Preparing:')) {
    sql = sql.replace(/.*?Preparing:\s*/, '').trim();
  }

  // 提取参数行 - 支持带有 ==> 前缀的参数行
  const paramsRegex = /(?:==>)?\s*Parameters:([\s\S]*?)(?=\n.*?\d{4}-\d{2}-\d{2}|<==|\[DEBUG\]|\[INFO\]|$)/i;
  const paramsMatch = decodedLog.match(paramsRegex);
  let paramsString = paramsMatch ? paramsMatch[1].trim() : "";

  // 如果参数字符串包含多行，只取第一行，避免无效信息影响
  if (paramsString.includes('\n')) {
    const lines = paramsString.split('\n');
    paramsString = lines.find(line =>
      line.includes('(Integer)') ||
      line.includes('(Long)') ||
      line.includes('(Date)') ||
      line.includes('(String)') ||
      line.includes('(Boolean)') ||
      line.includes('(Timestamp)')
    ) || lines[0];
    paramsString = paramsString.trim();
  }

  // 解析参数
  const params: SqlParam[] = [];
  if (paramsString) {
    // 改进的正则表达式，能够处理空值参数
    // 匹配形如 "value(Type)" 或 "(Type)" 的参数
    const paramRegex = /([^,()]*?)(\([^)]+\))(?=,|$)/g;
    let match;

    while ((match = paramRegex.exec(paramsString)) !== null) {
      const value = match[1].trim();
      const type = match[2].trim();

      // 根据类型处理参数值
      if (type.includes("String")) {
        // 处理字符串类型，包括空字符串
        params.push(value === "" ? "''" : `'${value}'`);
      } else if (type.includes("Timestamp") || type.includes("Date")) {
        // 处理日期时间类型
        params.push(`'${value}'`);
      } else if (type.includes("Boolean")) {
        params.push(value.toLowerCase() === "true" ? true : false);
      } else {
        // 数字类型
        params.push(value === "" ? "NULL" : value);
      }
    }
  }

  return { sql, params };
}

/**
 * 替换SQL中的占位符并格式化
 */
export function formatSql(sql: string, params: SqlParam[]): string {
  let formattedSql = sql;

  // 替换问号占位符
  let paramIndex = 0;
  formattedSql = formattedSql.replace(/\?/g, () => {
    const param = paramIndex < params.length ? params[paramIndex] : "?";
    paramIndex++;
    return String(param);
  });

  // 使用sql-formatter格式化SQL
  try {
    formattedSql = format(formattedSql, {
      language: "sql",
      keywordCase: "upper",
      indentStyle: "standard",
    });
  } catch (error) {
    console.error("SQL格式化失败:", error);
  }

  return formattedSql;
}

/**
 * 直接格式化SQL语句，不需要解析Mybatis日志
 */
export function formatRawSql(sql: string): string {
  try {
    return format(sql, {
      language: "sql",
      keywordCase: "upper",
      indentStyle: "standard",
    });
  } catch (error) {
    console.error("SQL格式化失败:", error);
    return sql;
  }
}
