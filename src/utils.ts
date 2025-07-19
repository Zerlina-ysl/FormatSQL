import { format } from "sql-formatter";

/**
 * SQL参数类型
 */
type SqlParam = string | number | boolean;

/**
 * 解析Mybatis日志，提取SQL语句和参数
 */
export function parseMybatisLog(log: string): { sql: string | null; params: SqlParam[] } {
  // 提取SQL语句 - 匹配SELECT/INSERT/UPDATE/DELETE开头的语句
  const sqlRegex =
    /(SELECT|INSERT|UPDATE|DELETE)[\s\S]*?(?=Parameters:|==>|<==|\d{4}-\d{2}-\d{2}|\[DEBUG\]|\[INFO\]|$)/i;
  const sqlMatch = log.match(sqlRegex);
  const sql = sqlMatch ? sqlMatch[0].trim() : null;

  // 提取参数行 - 支持带有 ==> 前缀的参数行
  const paramsRegex = /(?:==>)?\s*Parameters:([\s\S]*?)(?=<==|\[DEBUG\]|\[INFO\]|$)/i;
  const paramsMatch = log.match(paramsRegex);
  const paramsString = paramsMatch ? paramsMatch[1].trim() : "";

  // 解析参数
  const params: SqlParam[] = [];
  if (paramsString) {
    // 匹配形如 "value(Type)" 的参数
    const paramRegex = /([^,]+?)(\([^)]+\))(?=,|$)/g;
    let match;

    while ((match = paramRegex.exec(paramsString)) !== null) {
      const value = match[1].trim();
      const type = match[2].trim();

      // 根据类型处理参数值
      if (type.includes("String")) {
        params.push(`'${value}'`);
      } else if (type.includes("Timestamp") || type.includes("Date")) {
        // 处理日期时间类型
        params.push(`'${value}'`);
      } else if (type.includes("Boolean")) {
        params.push(value.toLowerCase() === "true" ? true : false);
      } else {
        // 数字类型
        params.push(value);
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
    return sql; // 如果格式化失败，返回原始SQL
  }
}
