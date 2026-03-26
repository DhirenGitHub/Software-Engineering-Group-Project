import IconNavBar from './IconNavBar'
import TopHeader from './TopHeader'

/**
 * PageLayout — shell wrapper used by every page.
 * Composes: IconNavBar (left) + TopHeader (top) + page content.
 */
export default function PageLayout({ title, children }) {
  return (
    <div style={styles.shell}>
      <IconNavBar />
      <div style={styles.main}>
        <TopHeader title={title} />
        <div style={styles.content}>{children}</div>
      </div>
    </div>
  )
}

const styles = {
  shell: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    backgroundColor: '#080808',
    overflow: 'hidden',
  },
  main: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
}
