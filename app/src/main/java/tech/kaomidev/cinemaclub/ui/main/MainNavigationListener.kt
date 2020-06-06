package tech.kaomidev.cinemaclub.ui.main

import android.view.MenuItem
import com.google.android.material.bottomnavigation.BottomNavigationView
import tech.kaomidev.cinemaclub.R

class MainNavigationListener(private val activity: MainActivity)
    : BottomNavigationView.OnNavigationItemSelectedListener {

    override fun onNavigationItemSelected(item: MenuItem): Boolean {

        return when(item.itemId) {
            R.id.navigation_favorites -> true
            R.id.navigation_discover ->  requestShowDiscoverMoviesFragment()
            R.id.navigation_profile -> true
            else -> false
        }
    }

    private fun requestShowDiscoverMoviesFragment(): Boolean {
        activity.showDiscoverMoviesFragment()
        return true
    }
}