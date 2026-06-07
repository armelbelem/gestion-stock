import db from '../../../../lib/db';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeUnit = searchParams.get('timeUnit') || 'day'; // day, week, month, year
    const period = searchParams.get('period') || 'all'; // Filters
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // Build WHERE clause
    let dateWhere = '';
    const queryParams = [];

    if (period === 'today') {
      dateWhere = 'AND DATE(s.date) = CURDATE()';
    } else if (period === 'week') {
      dateWhere = 'AND YEARWEEK(s.date, 1) = YEARWEEK(CURDATE(), 1)';
    } else if (period === 'month') {
      dateWhere = 'AND YEAR(s.date) = YEAR(CURDATE()) AND MONTH(s.date) = MONTH(CURDATE())';
    } else if (period === 'year') {
      dateWhere = 'AND YEAR(s.date) = YEAR(CURDATE())';
    } else if (period === 'custom' && startDateParam && endDateParam) {
      dateWhere = 'AND s.date >= ? AND s.date <= ?';
      queryParams.push(startDateParam, endDateParam);
    }

    let timeGroupExpr = '';
    if (timeUnit === 'day') {
      timeGroupExpr = 'DATE(s.date)';
    } else if (timeUnit === 'week') {
      timeGroupExpr = 'CONCAT(YEAR(s.date), "-", WEEK(s.date, 1))';
    } else if (timeUnit === 'month') {
      timeGroupExpr = 'CONCAT(YEAR(s.date), "-", LPAD(MONTH(s.date), 2, "0"))';
    } else if (timeUnit === 'year') {
      timeGroupExpr = 'YEAR(s.date)';
    }

    const chartQuery = `
      SELECT 
          ${timeGroupExpr} AS timeLabel,
          u.username AS sellerName,
          COUNT(DISTINCT s.id) AS salesCount,
          COALESCE(SUM(s.totalAmount), 0) AS revenue
      FROM users u
      JOIN sales s ON u.id = s.userId
      WHERE u.role = 'Vendeur' 
        AND s.status != 'annulée'
        ${dateWhere}
      GROUP BY timeLabel, u.username
      ORDER BY timeLabel ASC
    `;

    const [rows] = await db.query(chartQuery, queryParams);

    // Format the data for Recharts (e.g. pivoting by sellerName)
    // We want output like: [ { timeLabel: '2026-06-05', 'John': 10, 'Alice': 5 }, ... ]
    const formattedData = {};
    const sellersSet = new Set();

    rows.forEach(row => {
      if (!formattedData[row.timeLabel]) {
        formattedData[row.timeLabel] = { timeLabel: row.timeLabel };
      }
      formattedData[row.timeLabel][row.sellerName + '_sales'] = row.salesCount;
      formattedData[row.timeLabel][row.sellerName + '_revenue'] = row.revenue;
      sellersSet.add(row.sellerName);
    });

    const resultData = Object.values(formattedData);

    return NextResponse.json({
      success: true,
      data: resultData,
      sellers: Array.from(sellersSet)
    });

  } catch (error) {
    console.error('API Error in sellers chart report:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
