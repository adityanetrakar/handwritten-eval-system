import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import courseService from '../services/courseService';
import './DashboardPage.css';

const DashboardPage = () => {
  const [courses, setCourses] = useState([]);
  const [courseName, setCourseName] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch courses when the component loads
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setLoading(true);
        const data = await courseService.getMyCourses();
        setCourses(data);
      } catch (err) {
        setError('Failed to fetch courses.');
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, []); // Empty array means this runs once on mount

  // Handle the "Create Course" form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const newCourse = await courseService.createCourse(courseName, courseCode);
      // Add new course to the top of the list
      setCourses([newCourse, ...courses]); 
      // Clear the form
      setCourseName('');
      setCourseCode('');
    } catch (err) {
      setError('Failed to create course. Is the code unique?');
    }
  };

  return (
    <div className="dashboard-container">
      {/* --- Create Course Form --- */}
      <section className="create-course-form">
        <h3>Create a New Course</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="courseName">Course Name</label>
              <input
                type="text"
                id="courseName"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                placeholder="e.g., Computer Networks"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="courseCode">Course Code</label>
              <input
                type="text"
                id="courseCode"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                placeholder="e.g., CS101"
                required
              />
            </div>
          </div>
          <button type="submit" className="create-course-btn">
            Create Course
          </button>
          {error && <p style={{ color: 'red', marginTop: '1rem' }}>{error}</p>}
        </form>
      </section>

      {/* --- Course List --- */}
      <section className="course-list-section">
        <h2>My Courses</h2>
        {loading && <p>Loading courses...</p>}
        {!loading && courses.length === 0 && (
          <p>You haven't created any courses yet.</p>
        )}
        <div className="course-list">
          {courses.map((course) => (
            <Link to={`/course/${course._id}`} key={course._id} className="course-card">
              <div className="course-card-content">
                <h4>{course.courseName}</h4>
                <p>{course.courseCode}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

export default DashboardPage;