package tech.kaomidev.cinemaclub.ui.main

import android.app.SearchManager
import android.content.ComponentName
import android.content.Context
import android.os.Bundle
import android.view.Menu
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.SearchView
import androidx.fragment.app.Fragment
import kotlinx.android.synthetic.main.activity_main.*
import tech.kaomidev.cinemaclub.R
import tech.kaomidev.cinemaclub.ui.main.discovermovies.DiscoverMoviesFragment
import tech.kaomidev.cinemaclub.ui.search.SearchActivity
import tech.kaomidev.cinemaclub.utils.doOnNetwork


class MainActivity : AppCompatActivity() {

    private val navigationListener = MainNavigationListener(this)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        setSupportActionBar(toolbar)

        navigation.setOnNavigationItemSelectedListener(navigationListener)
        navigation.menu.getItem(1).isChecked = true

        doOnNetwork(this::showDiscoverMoviesFragment)
    }

    override fun onCreateOptionsMenu(menu: Menu?): Boolean {
        menuInflater.inflate(R.menu.menu_main, menu)

        val searchManager = getSystemService(Context.SEARCH_SERVICE) as SearchManager
        val searchView = menu?.findItem(R.id.action_search)?.actionView as SearchView
        val searchComponent = ComponentName(this, SearchActivity::class.java)

        searchView.setSearchableInfo(searchManager.getSearchableInfo(searchComponent))

        return true
    }

    fun showDiscoverMoviesFragment() {
        supportActionBar?.title = getString(R.string.title_discover)
        openFragment(DiscoverMoviesFragment.newInstance())
    }

    private fun openFragment(fragment: Fragment) {

        supportFragmentManager.beginTransaction()
            .setCustomAnimations(android.R.anim.fade_in, android.R.anim.fade_out)
            .replace(R.id.container, fragment)
            .commit()
    }
}
