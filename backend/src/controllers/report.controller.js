import { ReportService } from '../services/report.service.js';

const reportService = new ReportService();

export async function getProgressReport(req, res, next) {
  try {
    const report = reportService.getProgressReport({
      workspaceId: req.user.workspace_id,
      user: req.user
    });
    res.json({ report });
  } catch (err) {
    next(err);
  }
}

export async function getProductivityReport(req, res, next) {
  try {
    const { from, to } = req.query;
    const report = reportService.getProductivityReport({
      workspaceId: req.user.workspace_id,
      user: req.user,
      from,
      to
    });
    res.json({ report });
  } catch (err) {
    next(err);
  }
}

export async function getTimeSpentReport(req, res, next) {
  try {
    const { from, to } = req.query;
    const report = reportService.getTimeSpentReport({
      workspaceId: req.user.workspace_id,
      user: req.user,
      from,
      to
    });
    res.json({ report });
  } catch (err) {
    next(err);
  }
}

export async function exportCsv(req, res, next) {
  try {
    const { report, from, to } = req.query;
    const csvData = reportService.generateCsvExport({
      workspaceId: req.user.workspace_id,
      user: req.user,
      report,
      from,
      to
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=teamflow-${report || 'report'}-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csvData);
  } catch (err) {
    next(err);
  }
}
