import React, { useState, useEffect } from 'react';
import { remindersAPI } from '../../services/api';
import { Calendar, Clock, Bell, Plus, Edit, Trash2, Check, AlertCircle } from 'lucide-react';

const AdvancedReminders = () => {
  const [reminders, setReminders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingReminder, setEditingReminder] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchReminders();
    fetchStats();
  }, [filter]);

  const fetchReminders = async () => {
    try {
      const params = filter !== 'all' ? { type: filter } : {};
      const data = await remindersAPI.getReminders(params);
      setReminders(data.reminders || []);
    } catch (error) {
      console.error('Error fetching reminders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await remindersAPI.getReminderStats();
      setStats(data.stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleCompleteReminder = async (reminderId) => {
    try {
      await remindersAPI.completeReminder(reminderId);
      fetchReminders();
      fetchStats();
    } catch (error) {
      console.error('Error completing reminder:', error);
    }
  };

  const handleDeleteReminder = async (reminderId) => {
    if (window.confirm('Are you sure you want to delete this reminder?')) {
      try {
        await remindersAPI.deleteReminder(reminderId);
        fetchReminders();
        fetchStats();
      } catch (error) {
        console.error('Error deleting reminder:', error);
      }
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'border-red-500 bg-red-50';
      case 'medium': return 'border-yellow-500 bg-yellow-50';
      case 'low': return 'border-green-500 bg-green-50';
      default: return 'border-gray-300 bg-white';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'application_deadline': return <Calendar className="h-4 w-4" />;
      case 'interview': return <Clock className="h-4 w-4" />;
      case 'follow_up': return <Bell className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const isOverdue = (reminderDate) => {
    return new Date(reminderDate) < new Date();
  };

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-lg">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Smart Reminders</h2>
            <p className="opacity-90">AI-powered scheduling with email notifications</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-white text-blue-600 px-4 py-2 rounded-md font-medium hover:bg-gray-100 transition-colors flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Reminder
          </button>
        </div>

        {/* Stats Row */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm opacity-80">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.pending}</div>
              <div className="text-sm opacity-80">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.completed}</div>
              <div className="text-sm opacity-80">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-200">{stats.overdue}</div>
              <div className="text-sm opacity-80">Overdue</div>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-md">
        <div className="flex flex-wrap gap-2">
          {['all', 'application_deadline', 'interview', 'follow_up', 'custom'].map(filterType => (
            <button
              key={filterType}
              onClick={() => setFilter(filterType)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filter === filterType
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filterType === 'all' ? 'All' : filterType.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Reminders List */}
      <div className="space-y-3">
        {reminders.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow-md text-center">
            <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No reminders yet</h3>
            <p className="text-gray-600 mb-4">Create your first reminder to stay on top of deadlines</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Create Reminder
            </button>
          </div>
        ) : (
          reminders.map(reminder => (
            <div
              key={reminder.id}
              className={`bg-white border-l-4 p-4 rounded-lg shadow-md ${getPriorityColor(reminder.priority)} ${
                reminder.completed ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="text-gray-600">
                      {getTypeIcon(reminder.type)}
                    </div>
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {reminder.type.replace('_', ' ')}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      reminder.priority === 'high' ? 'bg-red-100 text-red-800' :
                      reminder.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {reminder.priority}
                    </span>
                    {isOverdue(reminder.reminderDate) && !reminder.completed && (
                      <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded-full">
                        Overdue
                      </span>
                    )}
                  </div>

                  <h3 className={`text-lg font-semibold mb-1 ${
                    reminder.completed ? 'line-through text-gray-500' : 'text-gray-900'
                  }`}>
                    {reminder.title}
                  </h3>

                  {reminder.description && (
                    <p className="text-gray-600 text-sm mb-2">{reminder.description}</p>
                  )}

                  <div className="flex items-center text-sm text-gray-500 space-x-4">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      {formatDate(reminder.reminderDate)}
                    </div>
                    
                    {reminder.internship && (
                      <div className="flex items-center">
                        <span className="text-blue-600 font-medium">
                          {reminder.internship.title} at {reminder.internship.company}
                        </span>
                      </div>
                    )}

                    {reminder.emailNotification && (
                      <div className="flex items-center">
                        <Bell className="h-4 w-4 mr-1" />
                        Email enabled
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  {!reminder.completed && (
                    <>
                      <button
                        onClick={() => handleCompleteReminder(reminder.id)}
                        className="p-2 text-green-600 hover:bg-green-100 rounded-md transition-colors"
                        title="Mark as completed"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      
                      <button
                        onClick={() => setEditingReminder(reminder)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
                        title="Edit reminder"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  
                  <button
                    onClick={() => handleDeleteReminder(reminder.id)}
                    className="p-2 text-red-600 hover:bg-red-100 rounded-md transition-colors"
                    title="Delete reminder"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {reminder.completed && reminder.completedAt && (
                <div className="mt-2 text-xs text-gray-500">
                  Completed on {formatDate(reminder.completedAt)}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Priority Distribution */}
      {stats && stats.byPriority && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Reminder Distribution</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.byPriority.high}</div>
              <div className="text-sm text-gray-600">High Priority</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.byPriority.medium}</div>
              <div className="text-sm text-gray-600">Medium Priority</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.byPriority.low}</div>
              <div className="text-sm text-gray-600">Low Priority</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedReminders;
