import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config/env.js';
import { csrfProtection } from './middleware/csrf.js';
import { errorHandler } from './middleware/errorHandler.js';
import { NotFoundError } from './utils/errors.js';

// Route imports
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import invitationRoutes from './routes/invitation.routes.js';
import teamRoutes from './routes/team.routes.js';
import projectRoutes from './routes/project.routes.js';
import taskRoutes from './routes/task.routes.js';
import subtaskRoutes from './routes/subtask.routes.js';
import labelRoutes from './routes/label.routes.js';
import templateRoutes from './routes/template.routes.js';
import recurrenceRoutes from './routes/recurrence.routes.js';
import searchRoutes from './routes/search.routes.js';
import commentRoutes from './routes/comment.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import calendarRoutes from './routes/calendar.routes.js';
import workloadRoutes from './routes/workload.routes.js';
import timeRoutes from './routes/time.routes.js';
import reportRoutes from './routes/report.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import leaveRoutes from './routes/leave.routes.js';
import performanceRoutes from './routes/performance.routes.js';
import backupRoutes from './routes/backup.routes.js';

export function createApp() {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS configuration
  app.use(cors({
    origin: config.CLIENT_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
  }));

  // Body parsing and cookies
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // CSRF protection for state-changing endpoints
  app.use(csrfProtection);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API v1 routes
  const apiV1 = express.Router();
  apiV1.use('/auth', authRoutes);
  apiV1.use('/users', userRoutes);
  apiV1.use('/invitations', invitationRoutes);
  apiV1.use('/teams', teamRoutes);
  apiV1.use('/projects', projectRoutes);
  apiV1.use('/tasks', taskRoutes);
  apiV1.use('/subtasks', subtaskRoutes);
  apiV1.use('/labels', labelRoutes);
  apiV1.use('/project-templates', templateRoutes);
  apiV1.use('/recurring-tasks', recurrenceRoutes);
  apiV1.use('/search', searchRoutes);
  apiV1.use('/comments', commentRoutes);
  apiV1.use('/notifications', notificationRoutes);
  apiV1.use('/calendar', calendarRoutes);
  apiV1.use('/workload', workloadRoutes);
  apiV1.use('/time-entries', timeRoutes);
  apiV1.use('/reports', reportRoutes);
  apiV1.use('/attendance', attendanceRoutes);
  apiV1.use('/leave', leaveRoutes);
  apiV1.use('/performance', performanceRoutes);
  apiV1.use('/backups', backupRoutes);

  app.use('/api/v1', apiV1);

  // 404 handler for unmatched routes
  app.use((req, res, next) => {
    next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
  });

  // Centralized error handler
  app.use(errorHandler);

  return app;
}
