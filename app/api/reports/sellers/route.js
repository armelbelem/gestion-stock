import db from '../../../lib/db';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all'; // today, week, month, year, custom, all
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    
    // Pagination & Sort
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const offset = (page - 1) * limit;
    
    const sortCol = searchParams.get('sortColumn') || 'totalRevenue';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'ASC' : 'DESC';

    // Build the WHERE clause for dates
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

    // Allowed sort columns
    const allowedSortCols = {
      sellerName: 'u.username',
      totalSales: 'totalSales',
      totalRevenue: 'totalRevenue',
      totalProductsSold: 'totalProductsSold'
    };
    
    const orderByClause = allowedSortCols[sortCol] || 'totalRevenue';

    // Count Total (for pagination)
    const countQuery = `
      SELECT COUNT(DISTINCT u.id) as totalCount
      FROM users u
      JOIN sales s ON u.id = s.userId
      WHERE u.role = 'Vendeur' 
        AND s.status != 'annulée'
        ${dateWhere}
    `;
    
    const [countResult] = await db.query(countQuery, queryParams);
    const totalRecords = countResult[0].totalCount;
    const totalPages = Math.ceil(totalRecords / limit);

    // Main Query
    const mainQuery = `
      SELECT 
          u.id AS sellerId,
          u.username AS sellerName,
          COUNT(DISTINCT s.id) AS totalSales,
          COALESCE(SUM(s.totalAmount), 0) AS totalRevenue,
          COALESCE(SUM(si.quantity), 0) AS totalProductsSold
      FROM users u
      JOIN sales s ON u.id = s.userId
      LEFT JOIN (
          SELECT saleId, SUM(quantity) as quantity
          FROM sale_items
          GROUP BY saleId
      ) si ON s.id = si.saleId
      WHERE u.role = 'Vendeur' 
        AND s.status != 'annulée'
        ${dateWhere}
      GROUP BY u.id, u.username
      ORDER BY ${orderByClause} ${sortOrder}
      LIMIT ? OFFSET ?
    `;

    // Append pagination params
    queryParams.push(limit, offset);

    const [rows] = await db.query(mainQuery, queryParams);
    
    // Also compute global KPIs
    const globalQuery = `
      SELECT 
          COUNT(DISTINCT s.id) AS globalSales,
          COALESCE(SUM(s.totalAmount), 0) AS globalRevenue
      FROM sales s
      JOIN users u ON s.userId = u.id
      WHERE u.role = 'Vendeur'
        AND s.status != 'annulée'
        ${dateWhere}
    `;
    // We only need the date queryParams for globalQuery, so slice the limit & offset
    const [globalResult] = await db.query(globalQuery, queryParams.slice(0, queryParams.length - 2));

    return NextResponse.json({
      success: true,
      data: rows,
      pagination: {
        total: totalRecords,
        page,
        limit,
        totalPages
      },
      summary: {
        globalSales: globalResult[0].globalSales || 0,
        globalRevenue: globalResult[0].globalRevenue || 0
      }
    });

  } catch (error) {
    console.error('API Error in sellers report:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
